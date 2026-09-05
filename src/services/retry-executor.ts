import { razorpay } from "@/lib/razorpay";
import type { Payment, RetryAttempt, Subscriber, Subscription } from "@/generated/prisma/client";

type RetryAttemptWithContext = RetryAttempt & {
  payment: Payment & {
    subscription: Subscription & {
      subscriber: Subscriber;
    };
  };
};

export interface RetryExecutionResult {
  razorpayPaymentLinkId: string;
  paymentLinkShortUrl: string;
}

/**
 * Executes one retry attempt by generating a fresh Razorpay Payment Link for
 * the exact failed amount — this app's controllable retry mechanism, since
 * there is no programmatic API to force a specific subscription charge
 * attempt on demand. Success here means "the link was created and the
 * customer can now pay it", not that the payment has actually been
 * recovered — that confirmation arrives later via the payment.failed/
 * captured webhook, correlated back to this attempt via `reference_id`.
 */
export async function executeRetry(
  retryAttempt: RetryAttemptWithContext
): Promise<RetryExecutionResult> {
  const { payment } = retryAttempt;
  const { subscription } = payment;
  const { subscriber } = subscription;

  const link = await razorpay.paymentLink.create({
    amount: payment.amount,
    currency: payment.currency,
    accept_partial: false,
    description: `Payment retry for subscription ${subscription.razorpaySubscriptionId} (attempt ${retryAttempt.attemptNumber})`,
    customer: {
      name: subscriber.name,
      email: subscriber.email,
      contact: subscriber.phone ?? undefined,
    },
    notify: { email: true, sms: Boolean(subscriber.phone) },
    reminder_enable: true,
    reference_id: retryAttempt.id,
    notes: {
      subscriptionId: subscription.id,
      paymentId: payment.id,
      retryAttemptId: retryAttempt.id,
    },
  });

  return { razorpayPaymentLinkId: link.id, paymentLinkShortUrl: link.short_url };
}
