# Recoverly

AI-powered revenue recovery for Razorpay merchants. Built for the Razorpay Buildathon (Track 3: AI Revenue Recovery).

## What it does

When a subscription payment fails on Razorpay, Recoverly reads *why* it failed, schedules a smarter retry based on that reason, executes the retry automatically, and shows the merchant a live dashboard of recovered revenue and a cashflow forecast. AI (Google Gemini) writes the plain-English explanation for each retry decision all money-critical timing logic is deterministic rule code, never the model.

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
5. Open http://localhost:3000 and log in with the `DEMO_EMAIL` / `DEMO_PASSWORD` from your `.env`.

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
