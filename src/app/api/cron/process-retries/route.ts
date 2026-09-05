import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { executeRetry } from "@/services/retry-executor";
import { RetryStatus } from "@/generated/prisma/enums";

// Payment Link creation is a network round-trip per retry; give a full batch
// room to finish within a single invocation.
export const maxDuration = 60;

const BATCH_SIZE = 20;

async function claimDueRetries(): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    // FOR UPDATE SKIP LOCKED lets overlapping cron invocations (Vercel does
    // not guarantee exactly-once delivery, and cron jobs can run longer than
    // the interval between them) claim disjoint sets of rows instead of
    // racing each other or blocking.
    const due = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM retry_attempts
      WHERE status = ${RetryStatus.PENDING}::"RetryStatus" AND "scheduledFor" <= ${new Date()}
      ORDER BY "scheduledFor" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;
    if (due.length === 0) return [];

    const ids = due.map((row) => row.id);
    await tx.retryAttempt.updateMany({
      where: { id: { in: ids } },
      data: { status: RetryStatus.PROCESSING },
    });
    return ids;
  });
}

async function processRetries() {
  const claimedIds = await claimDueRetries();

  let succeeded = 0;
  let failed = 0;

  for (const id of claimedIds) {
    const retryAttempt = await prisma.retryAttempt.findUniqueOrThrow({
      where: { id },
      include: { payment: { include: { subscription: { include: { subscriber: true } } } } },
    });

    try {
      const result = await executeRetry(retryAttempt);
      await prisma.retryAttempt.update({
        where: { id },
        data: {
          razorpayPaymentLinkId: result.razorpayPaymentLinkId,
          paymentLinkShortUrl: result.paymentLinkShortUrl,
          executedAt: new Date(),
        },
      });
      succeeded++;
    } catch (error) {
      await prisma.retryAttempt.update({
        where: { id },
        data: { status: RetryStatus.FAILED, executedAt: new Date() },
      });
      await prisma.apiError.create({
        data: {
          source: "cron:process-retries",
          context: id,
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
      failed++;
    }
  }

  return { claimed: claimedIds.length, succeeded, failed };
}

async function handle(request: NextRequest) {
  // Three accepted credentials for the same job, because Vercel Cron, an
  // external scheduler, and the dashboard's "Run cron now" button all
  // authenticate differently:
  // - Vercel Cron always calls via GET and sets `Authorization: Bearer
  //   <CRON_SECRET>` itself from the project's CRON_SECRET env var — this is
  //   Vercel's documented convention, not something this route controls.
  //   Vercel Hobby also only allows once-a-day cron schedules, so this path
  //   alone cannot deliver the every-15-minutes cadence this job wants.
  // - `x-cron-secret` supports POST from an external scheduler (e.g. a
  //   GitHub Actions cron, or a service like cron-job.org) that can hit this
  //   endpoint every 15 minutes on a free Vercel plan.
  // - A logged-in merchant session lets the dashboard call this endpoint
  //   directly from the browser without ever exposing CRON_SECRET to the
  //   client.
  const session = await auth();
  const authorizedBySession = Boolean(session?.user);

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const authorizedBySecret =
    Boolean(cronSecret) && (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret);

  if (!authorizedBySession && !authorizedBySecret) {
    if (!cronSecret) console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processRetries();
  return NextResponse.json({ status: "ok", ...result });
}

export const GET = handle;
export const POST = handle;
