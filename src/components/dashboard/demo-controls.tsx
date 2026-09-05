"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CheckCircle2, PlayCircle, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetcher, FetchError } from "@/lib/fetcher";
import { formatRupees } from "@/lib/format";
import { DEMO_SCENARIOS } from "@/lib/demo-scenarios";

interface SubscriptionOption {
  id: string;
  amount: number;
  currency: string;
  subscriber: { name: string; email: string };
}

interface SubscriptionsResponse {
  subscriptions: SubscriptionOption[];
}

type ActionMessage = { tone: "success" | "error"; text: string } | null;

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new FetchError(json?.error ?? `Request failed with status ${res.status}`, res.status);
  }
  return json;
}

function demoModeDisabledMessage(error: unknown) {
  return error instanceof FetchError && error.status === 404
    ? "Demo mode is disabled on this deployment (DEMO_MODE env var)."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";
}

export function DemoControls() {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<SubscriptionsResponse>("/api/subscriptions?take=50", fetcher);
  const subscriptions = data?.subscriptions ?? [];

  const [subscriptionId, setSubscriptionId] = useState("");
  const [scenarioKey, setScenarioKey] = useState(DEMO_SCENARIOS[0].key);
  const [forceDueNow, setForceDueNow] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [isMarkingRecovered, setIsMarkingRecovered] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);

  const activeSubscriptionId = subscriptionId || subscriptions[0]?.id || "";

  async function handleSimulate() {
    if (!activeSubscriptionId) {
      setMessage({ tone: "error", text: "No subscription to simulate a failure for yet." });
      return;
    }
    setIsSimulating(true);
    setMessage(null);
    try {
      await postJson("/api/demo/simulate-failure", {
        subscriptionId: activeSubscriptionId,
        errorCode: scenarioKey,
        forceDueNow,
      });
      const scenario = DEMO_SCENARIOS.find((s) => s.key === scenarioKey);
      setMessage({
        tone: "success",
        text: forceDueNow
          ? `Simulated "${scenario?.label}" — due now, ready for "Run cron now".`
          : `Simulated "${scenario?.label}" — dashboard updating.`,
      });
      await mutate("/api/forecast");
    } catch (error) {
      setMessage({ tone: "error", text: demoModeDisabledMessage(error) });
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleRunCron() {
    setIsRunningCron(true);
    setMessage(null);
    try {
      const result = await postJson("/api/cron/process-retries");
      setMessage({
        tone: "success",
        text: `Cron ran — claimed ${result.claimed}, succeeded ${result.succeeded}, failed ${result.failed}.`,
      });
      await mutate("/api/forecast");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to run the cron job.",
      });
    } finally {
      setIsRunningCron(false);
    }
  }

  async function handleMarkRecovered() {
    if (!activeSubscriptionId) {
      setMessage({ tone: "error", text: "No subscription selected." });
      return;
    }
    setIsMarkingRecovered(true);
    setMessage(null);
    try {
      const result = await postJson("/api/demo/simulate-recovery", {
        subscriptionId: activeSubscriptionId,
      });
      setMessage({
        tone: "success",
        text: `Marked recovered — ${formatRupees(result.recoveredAmount)} added to the recovered total.`,
      });
      await mutate("/api/forecast");
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof FetchError && error.status === 404 && error.message.startsWith("No in-flight")
            ? "No in-flight retry for this subscription yet — simulate a failure and run the cron first."
            : demoModeDisabledMessage(error),
      });
    } finally {
      setIsMarkingRecovered(false);
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-line bg-transparent p-4">
      <p className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
        Demo tools
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Manufacture a failed payment, force the retry cron to run, or mark the retry as recovered.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Subscription
          <select
            className="h-8 min-w-48 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            value={activeSubscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
          >
            {subscriptions.length === 0 && <option value="">No subscriptions yet</option>}
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subscriber.name} — {formatRupees(s.amount / 100)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Failure scenario
          <select
            className="h-8 min-w-48 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            value={scenarioKey}
            onChange={(e) => setScenarioKey(e.target.value)}
          >
            {DEMO_SCENARIOS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5"
            checked={forceDueNow}
            onChange={(e) => setForceDueNow(e.target.checked)}
          />
          Force due now
        </label>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSimulate}
          disabled={isSimulating || !activeSubscriptionId}
        >
          <PlayCircle className="size-3.5" />
          {isSimulating ? "Simulating…" : "Simulate failure"}
        </Button>

        <Button variant="outline" size="sm" onClick={handleRunCron} disabled={isRunningCron}>
          <TimerReset className="size-3.5" />
          {isRunningCron ? "Running…" : "Run cron now"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkRecovered}
          disabled={isMarkingRecovered || !activeSubscriptionId}
        >
          <CheckCircle2 className="size-3.5" />
          {isMarkingRecovered ? "Marking…" : "Mark recovered"}
        </Button>
      </div>

      {message && (
        <p
          className={
            message.tone === "error"
              ? "mt-3 text-xs text-status-critical"
              : "mt-3 text-xs text-status-good"
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
