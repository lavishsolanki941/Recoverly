import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEMO_SCENARIOS, findDemoScenario } from "@/lib/demo-scenarios";
import { processPaymentEvent } from "@/services/process-payment-event";

// Same background-AI-call reasoning as the webhook route — this also runs
// processPaymentEvent's deferred after() callback.
export const maxDuration = 30;

const bodySchema = z.object({
  subscriptionId: z.string().min(1),
  errorCode: z.enum(DEMO_SCENARIOS.map((s) => s.key) as [string, ...string[]]),
  // Demo-only: skip the scheduler's real delay so a "Run cron now" click
  // immediately picks this up. Still requires DEMO_MODE — a real webhook
  // never reaches this route at all, so production scheduling is untouched.
  forceDueNow: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // DEMO_MODE gates existence, not just access — off means a 404, so this
  // tooling is invisible (not just unauthorized) on a real deployment.
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: parsed.data.subscriptionId },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const scenario = findDemoScenario(parsed.data.errorCode);
  if (!scenario) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }

  // Manufactures a realistic payment.failed event and runs it through the
  // exact same pipeline a real webhook uses (processPaymentEvent), rather
  // than reimplementing classification/scheduling/AI-explanation here.
  const { paymentId, retryAttemptId } = await processPaymentEvent({
    subscriptionId: subscription.id,
    eventType: "payment.failed",
    razorpayPaymentId: `pay_demo_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
    razorpayOrderId: null,
    amount: subscription.amount,
    currency: subscription.currency,
    errorCode: scenario.errorCode,
    errorDescription: scenario.errorDescription,
    errorReason: scenario.errorReason,
  });

  // Applied as a follow-up update rather than a parameter on
  // processPaymentEvent itself — that function is shared with the real
  // webhook route and must never grow a "pretend this happened sooner" knob.
  if (parsed.data.forceDueNow && retryAttemptId) {
    await prisma.retryAttempt.update({
      where: { id: retryAttemptId },
      data: { scheduledFor: new Date() },
    });
  }

  return NextResponse.json({ status: "ok", paymentId, retryAttemptId }, { status: 201 });
}
