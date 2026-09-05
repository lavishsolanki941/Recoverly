import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";
import { SubscriptionStatus } from "@/generated/prisma/enums";

const createSubscriptionSchema = z.object({
  subscriber: z.object({
    name: z.string().min(1).max(50),
    email: z.email(),
    phone: z.string().min(1).max(15).optional(),
  }),
  razorpayPlanId: z.string().min(1),
  totalCount: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
  customerNotify: z.boolean().optional(),
  startAt: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
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

  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const { subscriber, razorpayPlanId, totalCount, quantity, customerNotify, startAt } = parsed.data;

  // Amount/currency are read from the Razorpay Plan, never trusted from the
  // request body — this is money-critical data and there is no local Plan model.
  let plan;
  try {
    plan = await razorpay.plans.fetch(razorpayPlanId);
  } catch {
    return NextResponse.json({ error: "Plan not found on Razorpay" }, { status: 400 });
  }

  const subscriberRecord = await prisma.subscriber.upsert({
    where: { email: subscriber.email },
    update: { name: subscriber.name, phone: subscriber.phone },
    create: { name: subscriber.name, email: subscriber.email, phone: subscriber.phone },
  });

  let razorpayCustomerId = subscriberRecord.razorpayCustomerId;
  if (!razorpayCustomerId) {
    try {
      const customer = await razorpay.customers.create({
        name: subscriber.name,
        email: subscriber.email,
        contact: subscriber.phone,
        fail_existing: 0,
      });
      razorpayCustomerId = customer.id;
      await prisma.subscriber.update({
        where: { id: subscriberRecord.id },
        data: { razorpayCustomerId },
      });
    } catch {
      return NextResponse.json({ error: "Failed to create customer on Razorpay" }, { status: 502 });
    }
  }

  let razorpaySubscription;
  try {
    razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: totalCount,
      quantity,
      customer_notify: customerNotify ?? true,
      start_at: startAt,
      notes: { subscriberId: subscriberRecord.id },
    });
  } catch {
    return NextResponse.json({ error: "Failed to create subscription on Razorpay" }, { status: 502 });
  }

  const subscription = await prisma.subscription.create({
    data: {
      subscriberId: subscriberRecord.id,
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayPlanId,
      // Razorpay always returns status "created" from subscriptions.create() —
      // later statuses (e.g. "authenticated", "active", "pending", "halted")
      // only arrive via webhooks, so this direct uppercase cast is only ever
      // exercised for the freshly-created case here.
      status: razorpaySubscription.status.toUpperCase() as SubscriptionStatus,
      amount: Number(plan.item.amount),
      currency: plan.item.currency,
      currentStart: razorpaySubscription.current_start
        ? new Date(razorpaySubscription.current_start * 1000)
        : null,
      currentEnd: razorpaySubscription.current_end
        ? new Date(razorpaySubscription.current_end * 1000)
        : null,
    },
    include: { subscriber: true },
  });

  return NextResponse.json(subscription, { status: 201 });
}

const listSubscriptionsSchema = z.object({
  status: z.enum(SubscriptionStatus).optional(),
  subscriberId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = listSubscriptionsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const { status, subscriberId, take, skip } = parsed.data;
  const where = { status, subscriberId };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: { subscriber: true },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.subscription.count({ where }),
  ]);

  return NextResponse.json({ subscriptions, total, take, skip });
}
