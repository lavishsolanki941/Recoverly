"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { PlayCircle, TimerReset } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

export function DemoControls() {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<SubscriptionsResponse>("/api/subscriptions?take=50", fetcher);
  const subscriptions = data?.subscriptions ?? [];

  const [subscriptionId, setSubscriptionId] = useState("");
  const [scenarioKey, setScenarioKey] = useState(DEMO_SCENARIOS[0].key);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRunningCron, setIsRunningCron] = useState(false);
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
      });
      const scenario = DEMO_SCENARIOS.find((s) => s.key === scenarioKey);
      setMessage({ tone: "success", text: `Simulated "${scenario?.label}" — dashboard updating.` });
      await mutate("/api/forecast");
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof FetchError && error.status === 404
            ? "Demo mode is disabled on this deployment (DEMO_MODE env var)."
            : error instanceof Error
              ? error.message
              : "Failed to simulate the failure.",
      });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo controls</CardTitle>
        <CardDescription>
          Manufacture a failed payment or force the retry cron to run right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
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
        </div>

        {message && (
          <p className={message.tone === "error" ? "text-xs text-status-critical" : "text-xs text-status-good"}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
