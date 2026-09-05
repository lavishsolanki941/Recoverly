# Recoverly

**Live Demo:** [recoverly-seven.vercel.app](https://recoverly-seven.vercel.app)  
**Demo Credentials:** `demo@recoverly.app` / `recoverly-demo`

AI-powered revenue recovery for Razorpay merchants. Built for the Razorpay Buildathon (Track 3: AI Revenue Recovery).

## What it does

Razorpay's default behavior retries a failed payment on a fixed schedule, regardless of why the payment failed. Treating them the same wastes recoverable revenue because temporary insufficient funds and permanently expired cards require completely different handling. 

Recoverly replaces blind retries with a reasoned strategy. When a payment fails, Recoverly categorizes the exact failure reason, schedules a smarter retry window based specifically on that reason, and executes it automatically. It then shows the merchant a live dashboard of recovered revenue and a dynamic cashflow forecast.

## Testing the live demo

Because a real bank decline cannot be easily forced live, the dashboard includes a tool to safely simulate the recovery flow:

1. Log in to the live demo using the provided test credentials.
2. Click **Simulate Failure** on a subscription. This fires a synthetic webhook so you can watch the full loop live without needing a real bank decline.
3. Watch the subscription immediately move to the "At Risk" list. 
4. Open the **Retry Reasoning** panel to read the AI-generated plain-English explanation.
5. Execute the scheduled retry (via the demo shortcut) to watch the recovery succeed and see the **Recovered Counter** and **Forecast Chart** update live.

## Architecture

> **Design Principle:** Retry timing and payment execution are 100% deterministic and auditable. AI (Google Gemini) is isolated strictly to the reasoning/explanation layer to translate complex gateway failure codes into human-readable insights for merchants.

* **Webhook Ingestion:** Catches `payment.failed` and `subscription.charged` events directly from Razorpay.
* **Smart Scheduler:** Categorizes failure codes into recoverable (temporary bank drops, insufficient funds) vs. unrecoverable (card expired, blacklisted) and schedules optimized retry windows.
* **AI Explainer Service:** Uses Google Gemini (`gemini-flash-lite-latest`) with dual-model fallback to generate merchant-friendly diagnostics.
* **Automated Recovery:** Generates Razorpay Payment Links and updates subscription statuses via daily Vercel Cron triggers.
* **Real-time Analytics:** Aggregates recovered revenue and projects a 30-day cashflow forecast on a Next.js/shadcn dashboard.


* **Security & Idempotency:**
Webhook ingestion uses strict HMAC-SHA256 signature verification over the raw request body. An idempotency table safely handles duplicate webhook deliveries (which Razorpay expects on retries) without double-processing.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- PostgreSQL (Neon) via Prisma
- Razorpay Node SDK (test mode) — Orders, Subscriptions, Payment Links, Webhooks
- Google Gemini (`@google/genai`, `gemini-flash-lite-latest`) for explanation text
- NextAuth (single demo account)
- Vercel Cron for scheduled retries

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Make sure `.env` exists in the project root with all keys filled in (see `.env.example` for the shape). **Never commit `.env`.**
3. Set up the database:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 and log in with your credentials (`demo@recoverly.app` / `recoverly-demo`).

## Environment variables

| Variable | Where it comes from | Client-safe? |
|---|---|---|
| `DATABASE_URL` | Neon connection string | No |
| `RAZORPAY_KEY_ID` | Razorpay dashboard (test mode) | Yes (as `NEXT_PUBLIC_`) |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard (test mode) | **No** |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | same value as `RAZORPAY_KEY_ID` | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | you choose it; set the same value in the Razorpay webhook config | **No** |
| `GEMINI_API_KEY` | Google AI Studio | **No** |
| `CRON_SECRET` | random string, protects the cron endpoint | **No** |
| `NEXTAUTH_SECRET` | random string | **No** |
| `NEXTAUTH_URL` | `http://localhost:3000` locally | n/a |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | seeded login | n/a |

## Notes

- Everything runs in Razorpay **test mode** — no real money moves.
- The Gemini free tier is rate-limited; if the AI explanation is briefly unavailable, the retry still schedules correctly using the rule-based strategy.
- Built to run on Vercel + Neon, both on free tiers.

## Future Scope

While the Buildathon MVP focuses purely on failed subscription payments, the architecture is designed to extend into Razorpay's broader Agent Studio vision:
* **Dispute Management:** Automatically gathering merchant evidence when a subscription payment is contested.
* **Abandoned Carts:** Applying the same AI-reasoning pipeline to one-off checkout drops.
* **Multi-channel Notifications:** Alerting merchants via WhatsApp/SMS for high-value unrecoverable failures.


