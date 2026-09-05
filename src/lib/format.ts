const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatRupees(amount: number): string {
  return rupeeFormatter.format(amount);
}

const compactRupeeFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatRupeesCompact(amount: number): string {
  return `₹${compactRupeeFormatter.format(amount)}`;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

export function formatRelativeTime(iso: string): string {
  const target = new Date(iso).getTime();
  const diffMs = target - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
