import type { ProjectStatus, PhaseStatus, FeatureStatus, Priority, BugSeverity, BugStatus } from "@/types";

interface StatusMeta {
  label: string;
  color: string; // badge bg/border classes
  text: string;
  dot: string;
}

export const PROJECT_STATUS_META: Record<ProjectStatus, StatusMeta> = {
  planning: { label: "Planning", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  active: { label: "Active", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  on_hold: { label: "On Hold", color: "bg-urgency-medium/15 border-urgency-medium/40", text: "text-urgency-medium", dot: "bg-urgency-medium" },
  completed: { label: "Completed", color: "bg-primary/15 border-primary/40", text: "text-primary", dot: "bg-primary" },
  archived: { label: "Archived", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const PHASE_STATUS_META: Record<PhaseStatus, StatusMeta> = {
  pending: { label: "Pending", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  completed: { label: "Completed", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  blocked: { label: "Blocked", color: "bg-urgency-critical/15 border-urgency-critical/40", text: "text-urgency-critical", dot: "bg-urgency-critical" },
};

export const FEATURE_STATUS_META: Record<FeatureStatus, StatusMeta> = {
  backlog: { label: "Backlog", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  planned: { label: "Planned", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  in_progress: { label: "In Progress", color: "bg-primary/15 border-primary/40", text: "text-primary", dot: "bg-primary" },
  testing: { label: "Testing", color: "bg-urgency-medium/15 border-urgency-medium/40", text: "text-urgency-medium", dot: "bg-urgency-medium" },
  done: { label: "Done", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
};

export const PRIORITY_META: Record<Priority, StatusMeta> = {
  low: { label: "Low", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  medium: { label: "Medium", color: "bg-urgency-medium/15 border-urgency-medium/40", text: "text-urgency-medium", dot: "bg-urgency-medium" },
  high: { label: "High", color: "bg-urgency-high/15 border-urgency-high/40", text: "text-urgency-high", dot: "bg-urgency-high" },
  critical: { label: "Critical", color: "bg-urgency-critical/15 border-urgency-critical/40", text: "text-urgency-critical", dot: "bg-urgency-critical" },
};

export const BUG_SEVERITY_META: Record<BugSeverity, StatusMeta> = PRIORITY_META as unknown as Record<BugSeverity, StatusMeta>;

export const BUG_STATUS_META: Record<BugStatus, StatusMeta> = {
  open: { label: "Open", color: "bg-urgency-critical/15 border-urgency-critical/40", text: "text-urgency-critical", dot: "bg-urgency-critical" },
  in_progress: { label: "In Progress", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  resolved: { label: "Resolved", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  wont_fix: { label: "Won't Fix", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  duplicate: { label: "Duplicate", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = (
  Object.keys(PROJECT_STATUS_META) as ProjectStatus[]
).map((value) => ({ value, label: PROJECT_STATUS_META[value].label }));

export const PHASE_STATUS_OPTIONS: { value: PhaseStatus; label: string }[] = (
  Object.keys(PHASE_STATUS_META) as PhaseStatus[]
).map((value) => ({ value, label: PHASE_STATUS_META[value].label }));

export const FEATURE_STATUS_OPTIONS: { value: FeatureStatus; label: string }[] = (
  Object.keys(FEATURE_STATUS_META) as FeatureStatus[]
).map((value) => ({ value, label: FEATURE_STATUS_META[value].label }));

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = (
  Object.keys(PRIORITY_META) as Priority[]
).map((value) => ({ value, label: PRIORITY_META[value].label }));

export const BUG_SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = (
  Object.keys(BUG_SEVERITY_META) as BugSeverity[]
).map((value) => ({ value, label: BUG_SEVERITY_META[value].label }));

export const BUG_STATUS_OPTIONS: { value: BugStatus; label: string }[] = (
  Object.keys(BUG_STATUS_META) as BugStatus[]
).map((value) => ({ value, label: BUG_STATUS_META[value].label }));

/** Lucide icon names available for a project's `icon` field, plus a
 * matching accent color to keep the picker simple. Rendered via the
 * PROJECT_ICON_MAP lookup in ProjectCard/ProjectForm. */
export const PROJECT_ICONS = [
  "folder",
  "rocket",
  "code",
  "database",
  "globe",
  "smartphone",
  "cpu",
  "layout-dashboard",
  "gamepad-2",
  "server",
] as const;
