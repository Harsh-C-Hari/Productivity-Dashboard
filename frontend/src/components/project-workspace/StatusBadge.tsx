import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  label: string;
  colorClass: string;
  textClass: string;
  dotClass: string;
  className?: string;
}

/** Shared rendering for any of the Record<Status, meta> maps in
 * lib/projectMeta.ts -- callers pass the resolved meta entry so this
 * component stays agnostic of which status enum it's rendering. */
export function StatusBadge({ label, colorClass, textClass, dotClass, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        colorClass,
        textClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </span>
  );
}
