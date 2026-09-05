"use client";

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/dashboard/state-views";
import { StatusBadge, retryStatusBadge } from "@/components/dashboard/status-badge";
import { formatRupees, formatRelativeTime } from "@/lib/format";
import type { AtRiskSubscription } from "@/services/forecast";

interface AtRiskListProps {
  data: AtRiskSubscription[] | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function AtRiskList({ data, isLoading, error, onRetry }: AtRiskListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>At-risk subscriptions</CardTitle>
        <CardDescription>Failed payments with a retry in progress.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message="Couldn't load at-risk subscriptions." onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="Nothing at risk right now — every subscription is up to date." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.map((item) => {
              const badge = item.retry ? retryStatusBadge(item.retry.status) : null;
              return (
                <li key={item.subscriptionId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.subscriberName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subscriberEmail}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatRupees(item.amount)}
                    </span>
                    {badge ? (
                      <div className="flex items-center gap-1.5">
                        <StatusBadge {...badge} />
                        {item.retry && (
                          <span className="text-xs text-muted-foreground">
                            next retry {formatRelativeTime(item.retry.scheduledFor)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <StatusBadge tone="critical" label="No retry scheduled" />
                    )}
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
