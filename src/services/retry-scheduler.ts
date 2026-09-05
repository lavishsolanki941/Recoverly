/**
 * Deterministic, reason-aware retry scheduling for failed subscription
 * payments. This is the "smarter than Razorpay's own retries" rule engine
 * the app is built around — Razorpay's built-in subscription retries run on
 * a fixed schedule (roughly once/day for a few days) regardless of *why* the
 * charge failed. Money-critical timing decisions live here as plain rule
 * code; Gemini (Phase 7) only ever generates the merchant-facing explanation
 * text, never the schedule.
 */

export type FailureCategory =
  | "INSUFFICIENT_FUNDS"
  | "BANK_OR_ISSUER_DECLINED"
  | "GATEWAY_OR_NETWORK_ERROR"
  | "NOT_RETRYABLE"
  | "UNKNOWN";

export interface RazorpayFailureInfo {
  errorCode?: string | null;
  errorReason?: string | null;
  errorDescription?: string | null;
}

export interface RetryPlan {
  category: FailureCategory;
  strategy: string;
  scheduledFor: Date;
}

interface RetryPolicy {
  /** Max number of retry attempts for this category. 0 = never auto-retry. */
  maxAttempts: number;
  /** Delay (hours) before each attempt, indexed by attemptNumber - 1. */
  delayHours: number[];
}

// Reasons that mean "the customer needs to change something" — retrying the
// same payment method on a timer will just fail again, so these are never
// auto-retried here (distinct from e.g. insufficient_funds, where the same
// method will likely succeed once the account is funded).
const NOT_RETRYABLE_PATTERN =
  /fraud|blacklist|stolen|lost_card|restricted_card|invalid_card|expired_card|invalid_expiry|card_not_supported/i;

const INSUFFICIENT_FUNDS_PATTERN = /insufficient_funds|insufficient_balance/i;

// error_source on the Razorpay payment entity is a small fixed set:
// customer, business, internal, gateway, issuer_bank (seen in the wild as
// "bank"). We don't currently pass error_source through to this classifier
// (only error_code/error_reason/error_description are stored on Payment),
// so bank/issuer declines are recognised by error_reason instead.
const BANK_DECLINE_PATTERN = /issuer_declined|risk_declined|payment_declined|do_not_honou?r/i;

const GATEWAY_ERROR_PATTERN = /gateway_error|processing_error|payment_error|payment_failed|technical_error/i;

const RETRY_POLICY: Record<FailureCategory, RetryPolicy> = {
  // Same payment method will likely work once the account is funded —
  // give it time, biased towards a typical payday cycle.
  INSUFFICIENT_FUNDS: { maxAttempts: 3, delayHours: [24, 72, 168] },
  // Often a transient risk-engine or issuer-side hiccup; back off gradually.
  BANK_OR_ISSUER_DECLINED: { maxAttempts: 3, delayHours: [6, 24, 72] },
  // Transient technical failure — safe to retry soon.
  GATEWAY_OR_NETWORK_ERROR: { maxAttempts: 3, delayHours: [0.5, 2, 6] },
  // Needs the customer to act (new card, etc.) — do not auto-retry.
  NOT_RETRYABLE: { maxAttempts: 0, delayHours: [] },
  // Unrecognised reason: retry conservatively rather than give up silently,
  // but don't hammer it as aggressively as a known-transient failure.
  UNKNOWN: { maxAttempts: 2, delayHours: [12, 48] },
};

export function classifyFailure(payment: RazorpayFailureInfo): FailureCategory {
  const reason = payment.errorReason ?? "";
  const code = payment.errorCode ?? "";
  const haystack = `${reason} ${code} ${payment.errorDescription ?? ""}`;

  if (NOT_RETRYABLE_PATTERN.test(haystack)) return "NOT_RETRYABLE";
  if (INSUFFICIENT_FUNDS_PATTERN.test(haystack)) return "INSUFFICIENT_FUNDS";
  if (BANK_DECLINE_PATTERN.test(haystack)) return "BANK_OR_ISSUER_DECLINED";
  if (GATEWAY_ERROR_PATTERN.test(haystack)) return "GATEWAY_OR_NETWORK_ERROR";
  return "UNKNOWN";
}

/**
 * Decides whether (and when) to retry a failed payment.
 *
 * @param attemptNumber 1-indexed — the attempt about to be scheduled.
 * @returns `null` if this category/attempt should not be retried (either
 *          inherently non-retryable, or the category's attempt budget is
 *          exhausted) — callers should treat that as "give up" for now.
 */
export function scheduleRetry(
  payment: RazorpayFailureInfo,
  attemptNumber: number,
  now: Date = new Date()
): RetryPlan | null {
  const category = classifyFailure(payment);
  const policy = RETRY_POLICY[category];

  if (attemptNumber < 1 || attemptNumber > policy.maxAttempts) return null;

  const delayHours = policy.delayHours[attemptNumber - 1];
  const scheduledFor = new Date(now.getTime() + delayHours * 60 * 60 * 1000);

  return {
    category,
    strategy: `${category.toLowerCase()}_attempt_${attemptNumber}`,
    scheduledFor,
  };
}

/** The attempt budget for a category — e.g. for surfacing "attempt N of M" to a human or the AI explainer. */
export function getMaxAttempts(category: FailureCategory): number {
  return RETRY_POLICY[category].maxAttempts;
}
