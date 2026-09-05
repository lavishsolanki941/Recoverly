"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/dashboard/state-views";
import { useAnimatedNumber } from "@/components/dashboard/use-animated-number";
import { formatRupees } from "@/lib/format";
import type { DashboardData } from "@/services/forecast";

interface RecoveredCounterProps {
  data: DashboardData["recovered"] | undefined;
  /** Currently at-risk payments with a retry in flight — data.atRisk.length. */
  activeRetries: number;
  /** Percent of *resolved* recent retries (succeeded/failed) that succeeded.
   * null when nothing has resolved yet — shown as "—", never a misleading 0%. */
  recoveryRate: number | null;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function RecoveredCounter({
  data,
  activeRetries,
  recoveryRate,
  isLoading,
  error,
  onRetry,
}: RecoveredCounterProps) {
  const animated = useAnimatedNumber(data?.totalAmount ?? 0);

  return (
    // The one deliberate dark anchor on the page — fixed near-black
    // regardless of the app's light/dark mode (see globals.css), so the ₹
    // figure always pops against it. Everything below stays on light
    // surfaces; this is the sole exception.
    <section className="rounded-3xl bg-linear-to-br from-anchor to-anchor-2 px-7 py-7 sm:px-10 sm:py-8">
      <p className="text-xs font-medium tracking-[0.14em] text-anchor-muted uppercase">
        Revenue recovered
      </p>

      {isLoading ? (
        <Skeleton className="mt-4 h-20 w-72 bg-anchor-foreground/10" />
      ) : error ? (
        // Locally re-point the shared ErrorState's tokens at anchor-safe
        // values — it's built for the light secondary cards, and its
        // default muted/border tokens would be near-invisible here.
        <div
          className="mt-2 [--border:color-mix(in_oklab,var(--anchor-foreground)_25%,transparent)] [--muted-foreground:var(--anchor-muted)]"
        >
          <ErrorState message="Couldn't load the recovered total." onRetry={onRetry} />
        </div>
      ) : (
        <>
          {/* The one hero figure this dashboard leads with — the only place
              the display serif appears, and the one animated moment on the
              page (count-up, reduced-motion aware). */}
          <p className="mt-1 font-display text-[clamp(3rem,9vw,4.5rem)] leading-[0.95] text-anchor-brand">
            {formatRupees(animated)}
          </p>
          <p className="mt-2 text-sm text-anchor-muted">
            {data && data.count > 0
              ? `From ${data.count} recovered payment${data.count === 1 ? "" : "s"}, via retry Payment Links.`
              : "No confirmed recoveries yet — this fills in as retries succeed."}
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-anchor-foreground/15 pt-4">
            <div>
              <dt className="text-[11px] font-medium tracking-[0.08em] text-anchor-muted uppercase">
                Recovered
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-medium text-anchor-foreground tabular-nums">
                {data?.count ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-[0.08em] text-anchor-muted uppercase">
                Active retries
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-medium text-anchor-foreground tabular-nums">
                {activeRetries}
              </dd>
            </div>
            <div>
              <dt
                className="text-[11px] font-medium tracking-[0.08em] text-anchor-muted uppercase"
                title="Share of the most recent resolved retries that succeeded"
              >
                Recovery rate
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-medium text-anchor-foreground tabular-nums">
                {recoveryRate === null ? "—" : `${recoveryRate}%`}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
