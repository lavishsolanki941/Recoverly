"use client";

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/dashboard/state-views";
import { StatusBadge, retryStatusBadge } from "@/components/dashboard/status-badge";
import { formatRupees, formatRelativeTime } from "@/lib/format";
import type { RetryReasoningItem } from "@/services/forecast";

interface RetryReasoningPanelProps {
  data: RetryReasoningItem[] | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function RetryReasoningPanel({ data, isLoading, error, onRetry }: RetryReasoningPanelProps) {
  return (
    <Card className="rounded-2xl border border-line-strong !bg-card-tint shadow-none ring-0" size="sm">
      <CardHeader>
        <CardTitle>Retry reasoning</CardTitle>
        <CardDescription>
          Why each retry was scheduled — AI-written explanations of each failure and retry decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message="Couldn't load retry reasoning." onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No retries scheduled yet." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.map((item) => {
              const badge = retryStatusBadge(item.status);
              return (
                <li key={item.retryAttemptId} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-medium">{item.subscriberName}</span>
                    <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
                      {formatRupees(item.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.reasoning}</p>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge {...badge} />
                    <span className="text-xs text-muted-foreground">
                      {item.status === "PENDING"
                        ? `scheduled ${formatRelativeTime(item.scheduledFor)}`
                        : item.executedAt
                          ? `executed ${formatRelativeTime(item.executedAt)}`
                          : null}
                    </span>
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
