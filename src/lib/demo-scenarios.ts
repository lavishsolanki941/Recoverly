// Curated, realistic Razorpay (error_code, error_reason, error_description)
// triples for the demo simulator — spans every FailureCategory bucket in
// retry-scheduler.ts so a demo can showcase each retry strategy. Shared
// between the demo API route and the dashboard's scenario picker so the
// labels shown to the user match what actually gets sent.

export interface DemoScenario {
  key: string;
  label: string;
  errorCode: string;
  errorReason: string;
  errorDescription: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "INSUFFICIENT_FUNDS",
    label: "Insufficient funds",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "insufficient_funds",
    errorDescription: "The customer's account does not have sufficient balance to complete the transaction.",
  },
  {
    key: "ISSUER_DECLINED",
    label: "Declined by card issuer",
    errorCode: "GATEWAY_ERROR",
    errorReason: "issuer_declined",
    errorDescription: "The payment was declined by the customer's card issuer or bank.",
  },
  {
    key: "GATEWAY_ERROR",
    label: "Gateway/network error",
    errorCode: "GATEWAY_ERROR",
    errorReason: "payment_failed",
    errorDescription: "The payment could not be processed due to a temporary gateway error.",
  },
  {
    key: "EXPIRED_CARD",
    label: "Expired card",
    errorCode: "BAD_REQUEST_ERROR",
    errorReason: "expired_card",
    errorDescription: "The card used for this payment has expired.",
  },
  {
    key: "BLACKLISTED_CARD",
    label: "Blacklisted card",
    errorCode: "GATEWAY_ERROR",
    errorReason: "card_blacklisted",
    errorDescription: "This card has been blacklisted and cannot be used.",
  },
];

export function findDemoScenario(key: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.key === key);
}
