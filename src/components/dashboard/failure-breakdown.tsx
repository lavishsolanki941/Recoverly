"use client";

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/dashboard/state-views";
import type { FailureCategory } from "@/services/retry-scheduler";
import type { RetryReasoningItem } from "@/services/forecast";

interface FailureBreakdownProps {
  data: RetryReasoningItem[] | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

const CATEGORY_LABELS: Record<FailureCategory, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds",
  BANK_OR_ISSUER_DECLINED: "Bank/issuer decline",
  GATEWAY_OR_NETWORK_ERROR: "Gateway/network error",
  NOT_RETRYABLE: "Not retryable",
  UNKNOWN: "Unclassified",
};

export function FailureBreakdown({ data, isLoading, error, onRetry }: FailureBreakdownProps) {
  const counts = new Map<FailureCategory, number>();
  for (const item of data ?? []) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  const total = data?.length ?? 0;
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card className="rounded-2xl border border-line-strong !bg-card-tint shadow-none ring-0" size="sm">
      <CardHeader>
        <CardTitle>Failures by type</CardTitle>
        <CardDescription>Recent retry attempts, grouped by classified reason.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message="Couldn't load the breakdown." onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <EmptyState message="No retries classified yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(([category, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <li key={category}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-foreground">{CATEGORY_LABELS[category]}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        category === "NOT_RETRYABLE"
                          ? "h-full rounded-full bg-status-critical"
                          : "h-full rounded-full bg-foreground/70"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
