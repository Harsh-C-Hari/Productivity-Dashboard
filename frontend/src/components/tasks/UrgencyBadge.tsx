import type { Urgency } from "@/types";
import { URGENCY_META } from "@/lib/urgency";
import { cn } from "@/lib/utils";

export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  const meta = URGENCY_META[urgency];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        meta.color,
        meta.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, urgency === "critical" && "animate-pulse-soft")} />
      {meta.label}
    </span>
  );
}
