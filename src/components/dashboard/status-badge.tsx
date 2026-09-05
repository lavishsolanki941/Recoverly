import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "good" | "warning" | "info" | "critical" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  good: "text-status-good bg-status-good/15 ring-status-good/25",
  warning: "text-status-warning bg-status-warning/15 ring-status-warning/25",
  info: "text-status-info bg-status-info/15 ring-status-info/25",
  critical: "text-status-critical bg-status-critical/15 ring-status-critical/25",
  neutral: "text-muted-foreground bg-muted ring-border",
};

// Status is never carried by color alone — every badge pairs an icon with a
// text label (some status hues sit below 3:1 contrast on the light surface).
export function StatusBadge({
  tone,
  label,
  icon: Icon,
}: {
  tone: StatusTone;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
        TONE_CLASSES[tone]
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
    </span>
  );
}

export function retryStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return { tone: "warning" as const, label: "Scheduled", icon: Clock };
    case "PROCESSING":
      return { tone: "info" as const, label: "Link sent", icon: Loader2 };
    case "SUCCEEDED":
      return { tone: "good" as const, label: "Recovered", icon: CheckCircle2 };
    case "FAILED":
      return { tone: "critical" as const, label: "Failed", icon: AlertTriangle };
    case "CANCELLED":
      return { tone: "neutral" as const, label: "Cancelled", icon: HelpCircle };
    default:
      return { tone: "neutral" as const, label: status, icon: HelpCircle };
  }
}

// For a payment the scheduler deliberately declined to retry (NOT_RETRYABLE
// — see retry-scheduler.ts). Distinct from retryStatusBadge's "No retry
// scheduled" fallback: this says *why*, so it reads as an intelligent
// decision rather than the app silently doing nothing.
export function nonRetryableBadge(errorReason: string | null) {
  const reason = (errorReason ?? "").toLowerCase();
  const cause = reason.includes("expired")
    ? "card expired"
    : reason.includes("blacklist")
      ? "card blacklisted"
      : null;
  return {
    tone: "critical" as const,
    label: cause ? `No retry — ${cause}, needs customer action` : "No retry — needs customer action",
    icon: AlertTriangle,
  };
}

export function failureCategoryBadge(category: string | null) {
  switch (category) {
    case "NOT_RETRYABLE":
      return { tone: "critical" as const, label: "Needs customer action", icon: AlertTriangle };
    case "INSUFFICIENT_FUNDS":
      return { tone: "warning" as const, label: "Insufficient funds", icon: Clock };
    case "BANK_OR_ISSUER_DECLINED":
      return { tone: "warning" as const, label: "Bank declined", icon: Clock };
    case "GATEWAY_OR_NETWORK_ERROR":
      return { tone: "warning" as const, label: "Network error", icon: Clock };
    case "UNKNOWN":
      return { tone: "neutral" as const, label: "Unclassified", icon: HelpCircle };
    default:
      return { tone: "neutral" as const, label: "Pending review", icon: HelpCircle };
  }
}
