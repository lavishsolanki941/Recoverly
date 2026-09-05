import { GoogleGenAI, ApiError as GenAiApiError, Type } from "@google/genai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FailureCategory } from "@/services/retry-scheduler";

// Gemini only ever produces narrative text for the merchant dashboard — the
// retry schedule itself is decided entirely by retry-scheduler.ts (plain
// rule code) before this is ever called. Nothing here can change when or
// whether a retry happens; a failure here just means no narrative.

// "gemini-2.5-flash" and "gemini-2.5-flash-lite" both 404 for this project
// ("no longer available to new users") — verified live against the
// configured GEMINI_API_KEY, not assumed. "gemini-flash-lite-latest" is a
// Google-maintained alias that always points at their current recommended
// lite-tier flash model, so it doesn't rot the way a dated model string does.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// A live stress test (5 back-to-back calls) showed the primary succeeding
// but with latency climbing under load, and other dated/preview model names
// intermittently 503/504ing — no single model name is reliably available at
// any given moment. If the primary fails for any reason, one retry against a
// second, distinct alias (not env-configurable — this is a resilience
// fallback, not a user preference) meaningfully raises the odds of getting a
// narrative at all before giving up.
const FALLBACK_MODEL = "gemini-flash-latest";
// This is always invoked from inside next/server's after() (see the webhook
// route), which runs once Razorpay's response has already been sent — so
// this only needs to fit the route's maxDuration, not Razorpay's 5s webhook
// response budget. Kept short enough that two attempts (primary + fallback)
// still fit comfortably inside that budget.
const REQUEST_TIMEOUT_MS = 10_000;

export interface FailureRecord {
  errorCode: string | null;
  errorReason: string | null;
  errorDescription: string | null;
  category: FailureCategory;
  amount: number;
  currency: string;
  attemptNumber: number;
  maxAttempts: number;
}

export interface AiExplanationResult {
  /** null when the AI call failed or was skipped — never a fabricated narrative. */
  explanation: string | null;
  /** 0 = routine, clear-cut case. 1 = unusual/ambiguous; the model is unsure
   * the deterministic category fits. Informational only — never used for timing. */
  confidencePenalty: number;
  /** Set only if the model notices something that looks misclassified or
   * otherwise worth a human's attention (e.g. description hints at fraud
   * despite a routine-decline category). Purely advisory — surfaced to the
   * merchant, never auto-applied to the retry schedule. */
  edgeCaseOverride: string | null;
}

const FALLBACK: AiExplanationResult = {
  explanation: null,
  confidencePenalty: 0,
  edgeCaseOverride: null,
};

const responseSchema = z.object({
  explanation: z.string().min(1).max(200),
  confidencePenalty: z.number().min(0).max(1),
  edgeCaseOverride: z.string().max(200).nullable(),
});

const SYSTEM_INSTRUCTION = `You write short, plain-English explanations for a merchant dashboard, describing why a subscription payment failed and why a retry was scheduled.

Rules:
1. Only reference the failure information given to you. Never invent, guess at, or add a failure reason that isn't present in the input.
2. Write for a non-technical small business owner — no jargon like "error code", "gateway", "API", or "webhook".
3. "explanation" must be 200 characters or fewer.
4. "confidencePenalty" is a number from 0 to 1: 0 means this is a routine, clear-cut case that clearly matches its category; closer to 1 means the situation is unusual or the failure reason doesn't cleanly fit the given category.
5. "edgeCaseOverride" is null unless something in the input looks like it may have been misclassified or needs a human's attention (e.g. the description hints at fraud despite being classified as a routine decline) — in that case, a short (<=200 char) flag describing the concern.
6. Respond with ONLY the JSON object matching the schema. No markdown, no code fences, no commentary.`;

function buildResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      explanation: {
        type: Type.STRING,
        maxLength: "200",
        description: "Merchant-facing explanation, <=200 characters, no jargon.",
      },
      confidencePenalty: {
        type: Type.NUMBER,
        minimum: 0,
        maximum: 1,
        description: "0 = routine/clear-cut, 1 = unusual/ambiguous.",
      },
      edgeCaseOverride: {
        type: Type.STRING,
        nullable: true,
        maxLength: "200",
        description: "Short flag if something looks misclassified; otherwise null.",
      },
    },
    required: ["explanation", "confidencePenalty", "edgeCaseOverride"],
  };
}

// Even with responseMimeType: "application/json", models occasionally still
// wrap output in a markdown fence — strip it defensively before parsing.
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function logAiError(message: string, input: FailureRecord) {
  try {
    await prisma.apiError.create({
      data: {
        source: "ai-explainer",
        context: input.category,
        message,
        details: { ...input },
      },
    });
  } catch (loggingError) {
    // Logging must never be the thing that breaks the pipeline either.
    console.error("Failed to log AI explainer error:", loggingError);
  }
}

async function callModel(
  ai: GoogleGenAI,
  model: string,
  input: FailureRecord
): Promise<AiExplanationResult> {
  const response = await ai.models.generateContent({
    model,
    contents: JSON.stringify(input),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(),
      temperature: 0.2,
      maxOutputTokens: 300,
      httpOptions: { timeout: REQUEST_TIMEOUT_MS },
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Empty response from Gemini");

  const parsedJson: unknown = JSON.parse(stripCodeFences(raw));
  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Response failed schema validation: ${parsed.error.message}`);
  }

  return parsed.data;
}

function describeError(error: unknown): string {
  return error instanceof GenAiApiError
    ? `Gemini API error (status ${error.status}): ${error.message}`
    : error instanceof Error
      ? error.message
      : "Unknown AI explainer error";
}

export async function explainFailure(input: FailureRecord): Promise<AiExplanationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await logAiError("GEMINI_API_KEY is not set", input);
    return FALLBACK;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    return await callModel(ai, PRIMARY_MODEL, input);
  } catch (primaryError) {
    try {
      return await callModel(ai, FALLBACK_MODEL, input);
    } catch (fallbackError) {
      await logAiError(
        `Primary model "${PRIMARY_MODEL}" failed: ${describeError(primaryError)} | ` +
          `Fallback model "${FALLBACK_MODEL}" failed: ${describeError(fallbackError)}`,
        input
      );
      return FALLBACK;
    }
  }
}
