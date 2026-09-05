"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/dashboard/state-views";
import { useAnimatedNumber } from "@/components/dashboard/use-animated-number";
import { formatRupees } from "@/lib/format";
import type { DashboardData } from "@/services/forecast";

interface RecoveredCounterProps {
  data: DashboardData["recovered"] | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function RecoveredCounter({ data, isLoading, error, onRetry }: RecoveredCounterProps) {
  const animated = useAnimatedNumber(data?.totalAmount ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue recovered</CardTitle>
        {isLoading ? (
          <Skeleton className="mt-2 h-12 w-48" />
        ) : error ? (
          <ErrorState message="Couldn't load the recovered total." onRetry={onRetry} />
        ) : (
          <>
            {/* Hero figure: the one number this dashboard leads with. */}
            <p className="font-heading text-5xl leading-tight font-semibold tabular-nums text-status-good">
              {formatRupees(animated)}
            </p>
            <CardDescription>
              {data && data.count > 0
                ? `From ${data.count} recovered payment${data.count === 1 ? "" : "s"}, via retry Payment Links.`
                : "No confirmed recoveries yet — this fills in as retries succeed."}
            </CardDescription>
          </>
        )}
      </CardHeader>
    </Card>
  );
}
