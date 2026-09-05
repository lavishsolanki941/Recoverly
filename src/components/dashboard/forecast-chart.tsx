"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/dashboard/state-views";
import { formatRupees, formatRupeesCompact, formatDateShort } from "@/lib/format";
import type { ForecastPoint } from "@/services/forecast";

interface ForecastChartProps {
  data: { points: ForecastPoint[]; horizonDays: number } | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

interface TooltipEntry {
  value: number;
  name: string;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-sm">
      <p className="mb-1.5 font-medium text-popover-foreground">
        {label && formatDateShort(label)}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-mono font-medium tabular-nums text-popover-foreground">
              {formatRupees(entry.value)}
            </span>
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForecastTable({ points }: { points: ForecastPoint[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Date</th>
            <th className="px-2 py-1.5 text-right font-medium">Baseline</th>
            <th className="px-2 py-1.5 text-right font-medium">With recovery</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {points.map((p) => (
            <tr key={p.date} className="border-t border-border">
              <td className="px-2 py-1.5">{formatDateShort(p.date)}</td>
              <td className="px-2 py-1.5 text-right">{formatRupees(p.baseline)}</td>
              <td className="px-2 py-1.5 text-right">{formatRupees(p.withRecovery)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ForecastChart({ data, isLoading, error, onRetry }: ForecastChartProps) {
  const points = data?.points ?? [];
  const isEmpty = points.length === 0 || points.every((p) => p.baseline === 0 && p.withRecovery === 0);

  return (
    <Card className="rounded-2xl border border-line-strong !bg-card-tint shadow-none ring-0" size="sm">
      <CardHeader>
        <CardTitle>Cashflow forecast</CardTitle>
        <CardDescription>
          Next {data?.horizonDays ?? 30} days — baseline renewals vs. with in-flight retries credited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-70 w-full" />
        ) : error ? (
          <ErrorState message="Couldn't load the forecast." onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState message="Not enough data yet to forecast — add subscriptions to see a projection." />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tickFormatter={(v: number) => formatRupeesCompact(v)}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                />
                <Line
                  type="monotone"
                  dataKey="withRecovery"
                  name="With recovery"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                />
              </LineChart>
            </ResponsiveContainer>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                View as table
              </summary>
              <div className="mt-2">
                <ForecastTable points={points} />
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
