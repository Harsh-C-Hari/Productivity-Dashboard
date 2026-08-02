import type { Urgency, TaskStatus } from "@/types";

/**
 * Mirrors backend `app/urgency.py` so form previews (e.g. Quick Capture)
 * can show a live urgency badge before the record round-trips to the
 * server. The server's computed value is always the source of truth
 * once a task is saved.
 */
export function computeUrgency(
  deadline: string | null,
  estimatedEffortHours: number,
  progress: number,
  status: TaskStatus
): Urgency {
  if (status === "done") return "none";

  if (!deadline) {
    const remainingEffort = estimatedEffortHours * (1 - progress / 100);
    return remainingEffort >= 8 ? "medium" : "low";
  }

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const remainingHours = (deadlineDate.getTime() - now.getTime()) / 1000 / 3600;

  if (remainingHours <= 0) return "critical";

  const remainingDays = remainingHours / 24;
  const remainingEffortHours = Math.max(estimatedEffortHours * (1 - progress / 100), 0);
  const timePressure = remainingEffortHours / Math.max(remainingHours, 0.5);

  if (timePressure >= 0.7 || remainingDays <= 1) return "critical";
  if (timePressure >= 0.4 || remainingDays <= 3) return "high";
  if (timePressure >= 0.15 || remainingDays <= 7) return "medium";
  return "low";
}

export const URGENCY_META: Record<
  Urgency,
  { label: string; color: string; text: string; dot: string }
> = {
  critical: {
    label: "Critical",
    color: "bg-urgency-critical/15 border-urgency-critical/40",
    text: "text-urgency-critical",
    dot: "bg-urgency-critical",
  },
  high: {
    label: "High",
    color: "bg-urgency-high/15 border-urgency-high/40",
    text: "text-urgency-high",
    dot: "bg-urgency-high",
  },
  medium: {
    label: "Medium",
    color: "bg-urgency-medium/15 border-urgency-medium/40",
    text: "text-urgency-medium",
    dot: "bg-urgency-medium",
  },
  low: {
    label: "Low",
    color: "bg-urgency-low/15 border-urgency-low/40",
    text: "text-urgency-low",
    dot: "bg-urgency-low",
  },
  none: {
    label: "Done",
    color: "bg-urgency-none/15 border-urgency-none/40",
    text: "text-urgency-none",
    dot: "bg-urgency-none",
  },
};

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  study: { label: "Study", color: "text-secondary" },
  assignment: { label: "Assignment", color: "text-primary" },
  project: { label: "Project", color: "text-accent" },
  exam: { label: "Exam", color: "text-urgency-critical" },
  reading: { label: "Reading", color: "text-urgency-medium" },
  personal: { label: "Personal", color: "text-urgency-low" },
  other: { label: "Other", color: "text-muted-foreground" },
};
