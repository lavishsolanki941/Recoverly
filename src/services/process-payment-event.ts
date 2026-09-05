import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, RetryStatus } from "@/generated/prisma/enums";
import { classifyFailure, getMaxAttempts, scheduleRetry } from "@/services/retry-scheduler";
import { explainFailure } from "@/services/ai-explainer";

// Shared by the real Razorpay webhook route and the demo simulate-failure
// route, so a manufactured demo failure runs through the exact same
// classification, retry-scheduling, and AI-explanation logic as a real one —
// the only difference is how the caller resolved `subscriptionId` and built
// the payment fields (a real invoice lookup vs. a chosen subscription).

export interface PaymentEventInput {
  subscriptionId: string;
  eventType: "payment.captured" | "payment.failed";
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  amount: number; // paise
  currency: string;
  errorCode: string | null;
  errorDescription: string | null;
  errorReason: string | null;
}

export async function processPaymentEvent(
  input: PaymentEventInput
): Promise<{ paymentId: string; retryAttemptId: string | null }> {
  const status = input.eventType === "payment.captured" ? PaymentStatus.CAPTURED : PaymentStatus.FAILED;
  const now = new Date();

  const errorFields = {
    errorCode: input.errorCode,
    errorDescription: input.errorDescription,
    errorReason: input.errorReason,
  };

  const paymentRecord = await prisma.payment.upsert({
    where: { razorpayPaymentId: input.razorpayPaymentId },
    update: {
      status,
      ...errorFields,
      capturedAt: status === PaymentStatus.CAPTURED ? now : undefined,
      failedAt: status === PaymentStatus.FAILED ? now : undefined,
    },
    create: {
      subscriptionId: input.subscriptionId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      amount: input.amount,
      currency: input.currency,
      status,
      ...errorFields,
      capturedAt: status === PaymentStatus.CAPTURED ? now : null,
      failedAt: status === PaymentStatus.FAILED ? now : null,
    },
  });

  let retryAttemptId: string | null = null;
  if (status === PaymentStatus.FAILED) {
    retryAttemptId = await scheduleRetryForFailedPayment(input.subscriptionId, paymentRecord, errorFields);
  }

  return { paymentId: paymentRecord.id, retryAttemptId };
}

async function scheduleRetryForFailedPayment(
  subscriptionId: string,
  payment: { id: string; amount: number; currency: string },
  errorFields: { errorCode: string | null; errorDescription: string | null; errorReason: string | null }
): Promise<string | null> {
  // attemptNumber counts retries for the *current* billing-cycle failure
  // streak — attempts made since the subscription's last successful charge
  // — so a subscription with old, already-recovered failures doesn't start
  // a new failure at an inflated attempt number.
  const lastCaptured = await prisma.payment.findFirst({
    where: { subscriptionId, status: PaymentStatus.CAPTURED },
    orderBy: { createdAt: "desc" },
  });
  const priorAttempts = await prisma.retryAttempt.count({
    where: {
      payment: {
        subscriptionId,
        ...(lastCaptured ? { createdAt: { gt: lastCaptured.createdAt } } : {}),
      },
    },
  });
  const attemptNumber = priorAttempts + 1;

  const plan = scheduleRetry(errorFields, attemptNumber);
  const category = plan?.category ?? classifyFailure(errorFields);

  await prisma.payment.update({
    where: { id: payment.id },
    data: { failureCategory: category },
  });

  if (!plan) return null;

  const retryAttempt = await prisma.retryAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber,
      strategy: plan.strategy,
      status: RetryStatus.PENDING,
      scheduledFor: plan.scheduledFor,
    },
  });

  // The retry is already scheduled at this point — the AI narrative is
  // strictly a later enrichment. Deferred via `after()` so a slow/failed
  // Gemini call can never eat into the caller's response budget (Razorpay's
  // 5s webhook window for the real route; instant feedback for the demo one).
  after(async () => {
    const result = await explainFailure({
      errorCode: errorFields.errorCode,
      errorReason: errorFields.errorReason,
      errorDescription: errorFields.errorDescription,
      category,
      amount: payment.amount / 100,
      currency: payment.currency,
      attemptNumber,
      maxAttempts: getMaxAttempts(category),
    });

    if (result.explanation === null) return;

    await prisma.retryAttempt.update({
      where: { id: retryAttempt.id },
      data: {
        aiExplanation: result.explanation,
        aiConfidencePenalty: result.confidencePenalty,
        aiEdgeCaseOverride: result.edgeCaseOverride,
      },
    });
  });

  return retryAttempt.id;
}
