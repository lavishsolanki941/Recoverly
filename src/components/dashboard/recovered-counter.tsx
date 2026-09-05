"use client";

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
    <section className="rounded-3xl bg-brand-wash px-8 py-10 sm:px-12 sm:py-12">
      <p className="text-xs font-medium tracking-[0.14em] text-brand-strong uppercase">
        Revenue recovered
      </p>

      {isLoading ? (
        <Skeleton className="mt-4 h-20 w-72 bg-brand/10" />
      ) : error ? (
        <div className="mt-2">
          <ErrorState message="Couldn't load the recovered total." onRetry={onRetry} />
        </div>
      ) : (
        <>
          {/* The one hero figure this dashboard leads with — the only place
              the display serif appears, and the one animated moment on the
              page (count-up, reduced-motion aware). */}
          <p className="mt-2 font-display text-[clamp(3rem,9vw,4.5rem)] leading-[0.95] text-brand-strong">
            {formatRupees(animated)}
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            {data && data.count > 0
              ? `From ${data.count} recovered payment${data.count === 1 ? "" : "s"}, via retry Payment Links.`
              : "No confirmed recoveries yet — this fills in as retries succeed."}
          </p>
        </>
      )}
    </section>
  );
}
