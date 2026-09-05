import Razorpay from "razorpay";

const globalForRazorpay = globalThis as unknown as {
  razorpay: Razorpay | undefined;
};

function createRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return new Razorpay({ key_id, key_secret });
}

export const razorpay = globalForRazorpay.razorpay ?? createRazorpayClient();

if (process.env.NODE_ENV !== "production") {
  globalForRazorpay.razorpay = razorpay;
}
