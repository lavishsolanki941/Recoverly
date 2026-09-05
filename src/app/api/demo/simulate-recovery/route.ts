import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, RetryStatus } from "@/generated/prisma/enums";

const bodySchema = z.object({
  subscriptionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  // Same existence-gating as the other demo routes.
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

  // The most recent in-flight retry for this subscription — the natural next
  // step after "Simulate failure" + "Run cron now" in the demo flow.
  const retryAttempt = await prisma.retryAttempt.findFirst({
    where: {
      status: { in: [RetryStatus.PENDING, RetryStatus.PROCESSING] },
      payment: { subscriptionId: parsed.data.subscriptionId },
    },
    orderBy: { createdAt: "desc" },
    include: { payment: true },
  });

  if (!retryAttempt) {
    return NextResponse.json(
      { error: "No in-flight retry to mark as recovered for this subscription." },
      { status: 404 }
    );
  }

  // Stands in for the real payment.captured webhook that would arrive once
  // the customer pays the retry's Payment Link — that correlation isn't
  // wired up yet (tracked for a later phase), so this demo route closes the
  // loop directly: a genuine CAPTURED Payment (so the forecast's captured
  // total reflects it going forward) plus the RetryAttempt marked SUCCEEDED
  // (so the recovered counter, which sums off SUCCEEDED retries, counts it).
  const recoveryPaymentId = `pay_demo_recovered_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const now = new Date();

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        subscriptionId: retryAttempt.payment.subscriptionId,
        razorpayPaymentId: recoveryPaymentId,
        amount: retryAttempt.payment.amount,
        currency: retryAttempt.payment.currency,
        status: PaymentStatus.CAPTURED,
        capturedAt: now,
      },
    }),
    prisma.retryAttempt.update({
      where: { id: retryAttempt.id },
      data: {
        status: RetryStatus.SUCCEEDED,
        executedAt: retryAttempt.executedAt ?? now,
        resultRazorpayPaymentId: recoveryPaymentId,
      },
    }),
  ]);

  return NextResponse.json(
    {
      status: "ok",
      recoveredAmount: retryAttempt.payment.amount / 100,
      currency: retryAttempt.payment.currency,
    },
    { status: 200 }
  );
}
