import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "good" | "warning" | "info" | "critical" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  good: "text-status-good bg-status-good/10",
  warning: "text-status-warning bg-status-warning/10",
  info: "text-status-info bg-status-info/10",
  critical: "text-status-critical bg-status-critical/10",
  neutral: "text-muted-foreground bg-muted",
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
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
