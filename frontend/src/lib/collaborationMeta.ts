import type { MemberStatus, InvitationStatus, ProjectVisibility, ProjectType } from "@/types/collaboration";

interface StatusMeta {
  label: string;
  color: string; // badge bg/border classes
  text: string;
  dot: string;
}

export const MEMBER_STATUS_META: Record<MemberStatus, StatusMeta> = {
  active: { label: "Active", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  invited: { label: "Invited", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  suspended: { label: "Suspended", color: "bg-urgency-medium/15 border-urgency-medium/40", text: "text-urgency-medium", dot: "bg-urgency-medium" },
  removed: { label: "Removed", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const INVITATION_STATUS_META: Record<InvitationStatus, StatusMeta> = {
  pending: { label: "Pending", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  accepted: { label: "Accepted", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  rejected: { label: "Rejected", color: "bg-urgency-critical/15 border-urgency-critical/40", text: "text-urgency-critical", dot: "bg-urgency-critical" },
  expired: { label: "Expired", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  revoked: { label: "Cancelled", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const VISIBILITY_META: Record<ProjectVisibility, { label: string; description: string }> = {
  private: { label: "Private", description: "Only members can see and access this project" },
  team: { label: "Team", description: "Visible to every member of your team (future)" },
  public: { label: "Public", description: "Shareable / discoverable outside the member list (future)" },
};

export const PROJECT_TYPE_META: Record<ProjectType, string> = {
  personal: "Personal",
  hackathon: "Hackathon",
  college_project: "College Project",
  startup: "Startup",
  research: "Research",
  open_source: "Open Source",
  freelance: "Freelance",
};

export const MEMBER_STATUS_OPTIONS: { value: MemberStatus; label: string }[] = (
  Object.keys(MEMBER_STATUS_META) as MemberStatus[]
).map((value) => ({ value, label: MEMBER_STATUS_META[value].label }));

export const VISIBILITY_OPTIONS: { value: ProjectVisibility; label: string }[] = (
  Object.keys(VISIBILITY_META) as ProjectVisibility[]
).map((value) => ({ value, label: VISIBILITY_META[value].label }));

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = (
  Object.keys(PROJECT_TYPE_META) as ProjectType[]
).map((value) => ({ value, label: PROJECT_TYPE_META[value] }));

/** Initials fallback for a member/user avatar -- same idea across every
 * MemberRow/InvitationRow/SessionRow-style component in the app. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic permission-group label from a permission's `category`
 * (e.g. "members" -> "Members"), used by the Permission Viewer/Matrix to
 * group the flat Permission[] catalog without a second backend concept. */
export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
