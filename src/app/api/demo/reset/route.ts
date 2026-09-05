import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/generated/prisma/enums";

// Demo-only: wipes every Payment/RetryAttempt (this app is single-tenant —
// see schema.prisma — so "for the demo merchant" means "all of them") and
// resets every Subscription to a fresh ACTIVE billing cycle, so the dashboard
// reads ₹0 recovered with nothing at-risk. Subscriber/Subscription rows are
// kept, not deleted — they're tied to real Razorpay test-mode entities
// (customer/subscription IDs), unlike Payment/RetryAttempt which are wholly
// local bookkeeping this app itself created.
export async function POST() {
  // Same existence-gating as the other demo routes.
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [deletedRetryAttempts, deletedPayments, resetSubscriptions] = await prisma.$transaction([
    // Must run before deleting Payment — RetryAttempt.paymentId is a required FK.
    prisma.retryAttempt.deleteMany({}),
    prisma.payment.deleteMany({}),
    prisma.subscription.updateMany({
      data: { status: SubscriptionStatus.ACTIVE, currentStart: now, currentEnd },
    }),
  ]);

  return NextResponse.json({
    status: "ok",
    deletedPayments: deletedPayments.count,
    deletedRetryAttempts: deletedRetryAttempts.count,
    resetSubscriptions: resetSubscriptions.count,
  });
}
