import { prisma } from "@/lib/prisma";
import { PaymentStatus, RetryStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import type { FailureCategory } from "@/services/retry-scheduler";

const FORECAST_HORIZON_DAYS = 30;

export interface ForecastPoint {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** Cumulative rupees, assuming every scheduled renewal simply succeeds. */
  baseline: number;
  /** Baseline plus amounts from retries currently in flight (PENDING/PROCESSING),
   * credited on the day they're scheduled to land. Projected, not confirmed —
   * nothing here claims a retry has already succeeded. */
  withRecovery: number;
}

export interface AtRiskSubscription {
  subscriptionId: string;
  // A subscription can have more than one failed payment with an active
  // retry at once (e.g. two separate billing cycles both still in-flight),
  // so subscriptionId alone isn't unique across this list — paymentId is.
  paymentId: string;
  subscriberName: string;
  subscriberEmail: string;
  amount: number;
  currency: string;
  errorReason: string | null;
  failureCategory: string | null;
  failedAt: string | null;
  retry: {
    id: string;
    attemptNumber: number;
    status: string;
    scheduledFor: string;
    strategy: string;
    paymentLinkShortUrl: string | null;
  } | null;
}

export interface RetryReasoningItem {
  retryAttemptId: string;
  subscriberName: string;
  amount: number;
  currency: string;
  category: FailureCategory;
  attemptNumber: number;
  status: string;
  scheduledFor: string;
  executedAt: string | null;
  reasoning: string;
  paymentLinkShortUrl: string | null;
}

export interface DashboardData {
  forecast: { points: ForecastPoint[]; horizonDays: number };
  recovered: { totalAmount: number; currency: string; count: number };
  atRisk: AtRiskSubscription[];
  retryReasoning: RetryReasoningItem[];
  generatedAt: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

async function computeForecast(): Promise<DashboardData["forecast"]> {
  const today = startOfUtcDay(new Date());
  const horizonEnd = addDays(today, FORECAST_HORIZON_DAYS - 1);

  const [capturedTotal, renewals, inFlightRetries] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: PaymentStatus.CAPTURED },
      _sum: { amount: true },
    }),
    prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentEnd: { gte: today, lte: horizonEnd },
      },
      select: { amount: true, currentEnd: true },
    }),
    prisma.retryAttempt.findMany({
      where: {
        status: { in: [RetryStatus.PENDING, RetryStatus.PROCESSING] },
        scheduledFor: { gte: today, lte: horizonEnd },
      },
      select: { scheduledFor: true, payment: { select: { amount: true } } },
    }),
  ]);

  const renewalByDay = new Map<string, number>();
  for (const r of renewals) {
    if (!r.currentEnd) continue;
    const key = dateKey(r.currentEnd);
    renewalByDay.set(key, (renewalByDay.get(key) ?? 0) + paiseToRupees(r.amount));
  }

  const recoveryByDay = new Map<string, number>();
  for (const r of inFlightRetries) {
    const key = dateKey(r.scheduledFor);
    recoveryByDay.set(key, (recoveryByDay.get(key) ?? 0) + paiseToRupees(r.payment.amount));
  }

  const startingTotal = paiseToRupees(capturedTotal._sum.amount ?? 0);
  const points: ForecastPoint[] = [];
  let baselineRunning = startingTotal;
  let withRecoveryRunning = startingTotal;

  for (let i = 0; i < FORECAST_HORIZON_DAYS; i++) {
    const key = dateKey(addDays(today, i));
    const renewal = renewalByDay.get(key) ?? 0;
    const recovery = recoveryByDay.get(key) ?? 0;
    baselineRunning += renewal;
    withRecoveryRunning += renewal + recovery;
    points.push({
      date: key,
      baseline: Math.round(baselineRunning * 100) / 100,
      withRecovery: Math.round(withRecoveryRunning * 100) / 100,
    });
  }

  return { points, horizonDays: FORECAST_HORIZON_DAYS };
}

async function computeRecovered(): Promise<DashboardData["recovered"]> {
  // Confirmed recoveries only — a RetryAttempt reaches SUCCEEDED once the
  // payment.captured webhook confirms its Payment Link was paid. That
  // closing-the-loop correlation isn't wired up yet (tracked for a later
  // phase), so this honestly reads ₹0 until then rather than counting
  // in-flight attempts as if they'd already succeeded.
  const succeeded = await prisma.retryAttempt.findMany({
    where: { status: RetryStatus.SUCCEEDED },
    select: { payment: { select: { amount: true, currency: true } } },
  });

  const totalAmount = succeeded.reduce((sum, r) => sum + r.payment.amount, 0);
  return {
    totalAmount: paiseToRupees(totalAmount),
    currency: succeeded[0]?.payment.currency ?? "INR",
    count: succeeded.length,
  };
}

async function computeAtRisk(): Promise<AtRiskSubscription[]> {
  const payments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.FAILED,
      OR: [
        // The normal case — a retry is actively scheduled/in flight.
        { retryAttempts: { some: { status: { in: [RetryStatus.PENDING, RetryStatus.PROCESSING] } } } },
        // NOT_RETRYABLE failures (expired/blacklisted/stolen card, etc.) never
        // get a RetryAttempt row at all — the scheduler deliberately declines
        // to retry. Surface them here too, so that deliberate "no retry"
        // decision is visible rather than looking like the app did nothing.
        { failureCategory: "NOT_RETRYABLE", retryAttempts: { none: {} } },
      ],
    },
    orderBy: { failedAt: "desc" },
    take: 20,
    include: {
      subscription: { include: { subscriber: true } },
      retryAttempts: {
        where: { status: { in: [RetryStatus.PENDING, RetryStatus.PROCESSING] } },
        orderBy: { attemptNumber: "desc" },
        take: 1,
      },
    },
  });

  return payments.map((payment) => {
    const retry = payment.retryAttempts[0];
    return {
      subscriptionId: payment.subscription.id,
      paymentId: payment.id,
      subscriberName: payment.subscription.subscriber.name,
      subscriberEmail: payment.subscription.subscriber.email,
      amount: paiseToRupees(payment.amount),
      currency: payment.currency,
      errorReason: payment.errorReason,
      failureCategory: payment.failureCategory,
      failedAt: payment.failedAt?.toISOString() ?? null,
      retry: retry
        ? {
            id: retry.id,
            attemptNumber: retry.attemptNumber,
            status: retry.status,
            scheduledFor: retry.scheduledFor.toISOString(),
            strategy: retry.strategy,
            paymentLinkShortUrl: retry.paymentLinkShortUrl,
          }
        : null,
    };
  });
}

// RetryAttempt.strategy is generated by retry-scheduler.ts as
// `${category.toLowerCase()}_attempt_${n}` — recover the category from it
// rather than duplicating classification logic here.
function categoryFromStrategy(strategy: string): FailureCategory {
  const category = strategy.replace(/_attempt_\d+$/, "").toUpperCase();
  const known: FailureCategory[] = [
    "INSUFFICIENT_FUNDS",
    "BANK_OR_ISSUER_DECLINED",
    "GATEWAY_OR_NETWORK_ERROR",
    "NOT_RETRYABLE",
    "UNKNOWN",
  ];
  return (known as string[]).includes(category) ? (category as FailureCategory) : "UNKNOWN";
}

const CATEGORY_EXPLANATION: Record<FailureCategory, string> = {
  INSUFFICIENT_FUNDS:
    "classified as insufficient funds — retrying with extra time for the account to be funded",
  BANK_OR_ISSUER_DECLINED:
    "classified as a bank/issuer decline — often transient, retrying with a short backoff",
  GATEWAY_OR_NETWORK_ERROR:
    "classified as a gateway or network error — likely transient, retrying soon",
  NOT_RETRYABLE:
    "classified as not auto-retryable — needs the customer to update their payment method",
  UNKNOWN: "the failure reason wasn't recognized — retrying conservatively",
};

function explainRetry(
  category: FailureCategory,
  attemptNumber: number,
  errorReason: string | null
): string {
  const reasonPhrase = errorReason ? `"${errorReason}"` : "an unspecified reason";
  return `Payment failed with ${reasonPhrase}, ${CATEGORY_EXPLANATION[category]} (attempt ${attemptNumber}).`;
}

async function computeRetryReasoning(): Promise<RetryReasoningItem[]> {
  const attempts = await prisma.retryAttempt.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { payment: { include: { subscription: { include: { subscriber: true } } } } },
  });

  return attempts.map((attempt) => {
    const category = categoryFromStrategy(attempt.strategy);
    return {
      retryAttemptId: attempt.id,
      subscriberName: attempt.payment.subscription.subscriber.name,
      amount: paiseToRupees(attempt.payment.amount),
      currency: attempt.payment.currency,
      category,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      scheduledFor: attempt.scheduledFor.toISOString(),
      executedAt: attempt.executedAt?.toISOString() ?? null,
      reasoning: explainRetry(category, attempt.attemptNumber, attempt.payment.errorReason),
      paymentLinkShortUrl: attempt.paymentLinkShortUrl,
    };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const [forecast, recovered, atRisk, retryReasoning] = await Promise.all([
    computeForecast(),
    computeRecovered(),
    computeAtRisk(),
    computeRetryReasoning(),
  ]);

  return { forecast, recovered, atRisk, retryReasoning, generatedAt: new Date().toISOString() };
}
