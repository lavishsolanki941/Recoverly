import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Fake IDs standing in for real Razorpay entities — this seed is demo data,
// not something created through the Razorpay API (that's Phase 3+).
const DEMO_PLAN_ID = "plan_demo0000000001";

async function main() {
  const subscriber = await prisma.subscriber.upsert({
    where: { email: "priya.sharma@example.com" },
    update: {},
    create: {
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone: "+919876543210",
      razorpayCustomerId: "cust_demo0000000001",
    },
  });

  const subscription = await prisma.subscription.upsert({
    where: { razorpaySubscriptionId: "sub_demo0000000001" },
    update: {},
    create: {
      subscriberId: subscriber.id,
      razorpaySubscriptionId: "sub_demo0000000001",
      razorpayPlanId: DEMO_PLAN_ID,
      status: "ACTIVE",
      amount: 49900, // paise -> ₹499.00
      currency: "INR",
      currentStart: new Date(),
      currentEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log({ subscriber, subscription });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
