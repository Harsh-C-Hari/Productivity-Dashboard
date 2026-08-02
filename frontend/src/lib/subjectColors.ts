/**
 * Shared color-tag palette for subjects. Deliberately mirrors the
 * palette already used by the Weekly Timetable (`TimetableCard.tsx`),
 * since subjects and timetable slots use the same "color" concept.
 */
export const SUBJECT_COLORS = ["purple", "blue", "cyan", "pink", "green", "orange"] as const;

export const SUBJECT_COLOR_HEX: Record<string, string> = {
  purple: "#D9A75B",
  blue: "#7C8B99",
  cyan: "#8FA98C",
  pink: "#C98FA0",
  green: "#7FA872",
  orange: "#D9915A",
};

export const SUBJECT_COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  purple: { border: "border-l-primary", bg: "bg-primary/[0.07]", text: "text-primary", dot: "bg-primary" },
  blue: { border: "border-l-secondary", bg: "bg-secondary/[0.07]", text: "text-secondary", dot: "bg-secondary" },
  cyan: { border: "border-l-accent", bg: "bg-accent/[0.07]", text: "text-accent", dot: "bg-accent" },
  pink: { border: "border-l-[#C98FA0]", bg: "bg-[#C98FA0]/[0.07]", text: "text-[#C98FA0]", dot: "bg-[#C98FA0]" },
  green: { border: "border-l-urgency-low", bg: "bg-urgency-low/[0.07]", text: "text-urgency-low", dot: "bg-urgency-low" },
  orange: { border: "border-l-urgency-high", bg: "bg-urgency-high/[0.07]", text: "text-urgency-high", dot: "bg-urgency-high" },
};

export function subjectColorHex(color: string | null | undefined): string {
  return SUBJECT_COLOR_HEX[color ?? "purple"] ?? SUBJECT_COLOR_HEX.purple;
}
