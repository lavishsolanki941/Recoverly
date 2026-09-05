"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { DashboardData } from "@/services/forecast";
import { RecoveredCounter } from "@/components/dashboard/recovered-counter";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { AtRiskList } from "@/components/dashboard/at-risk-list";
import { RetryReasoningPanel } from "@/components/dashboard/retry-reasoning-panel";
import { FailureBreakdown } from "@/components/dashboard/failure-breakdown";
import { DemoControls } from "@/components/dashboard/demo-controls";

// Polls live DB state without a manual refresh. The cron only runs every
// 15 minutes, but webhooks and manual triggers can change state anytime, so
// this polls faster than that to feel live without hammering the endpoint.
const REFRESH_INTERVAL_MS = 15_000;

export function DashboardContent() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>("/api/forecast", fetcher, {
    refreshInterval: REFRESH_INTERVAL_MS,
    // Keep the previous render on screen while revalidating instead of
    // flashing back to a loading state on every poll.
    keepPreviousData: true,
  });

  const onRetry = () => mutate();
  const hasError = Boolean(error);
  const stillLoading = isLoading && !data;

  // Hero supporting stats — derived from data already fetched for the rest
  // of the dashboard, not a separate call.
  const activeRetries = data?.atRisk.length ?? 0;
  const resolvedRetries = (data?.retryReasoning ?? []).filter(
    (r) => r.status === "SUCCEEDED" || r.status === "FAILED"
  );
  const recoveryRate =
    resolvedRetries.length > 0
      ? Math.round(
          (resolvedRetries.filter((r) => r.status === "SUCCEEDED").length / resolvedRetries.length) * 100
        )
      : null;

  return (
    <div className="flex flex-col gap-5">
      <RecoveredCounter
        data={data?.recovered}
        activeRetries={activeRetries}
        recoveryRate={recoveryRate}
        isLoading={stillLoading}
        error={hasError}
        onRetry={onRetry}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ForecastChart
            data={data?.forecast}
            isLoading={stillLoading}
            error={hasError}
            onRetry={onRetry}
          />
        </div>
        <AtRiskList
          data={data?.atRisk}
          isLoading={stillLoading}
          error={hasError}
          onRetry={onRetry}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RetryReasoningPanel
            data={data?.retryReasoning}
            isLoading={stillLoading}
            error={hasError}
            onRetry={onRetry}
          />
        </div>
        <FailureBreakdown
          data={data?.retryReasoning}
          isLoading={stillLoading}
          error={hasError}
          onRetry={onRetry}
        />
      </div>

      <DemoControls />
    </div>
  );
}
