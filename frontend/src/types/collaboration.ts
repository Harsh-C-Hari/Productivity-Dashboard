// Project Collaboration types -- mirrors backend/app/schemas.py's
// "---------- Permissions ----------", "---------- Roles ----------",
// "---------- Project Members ----------", "---------- Project Invitations ----------"
// and "---------- Collaboration: Aggregate Summary ----------" sections.
// Kept in its own file rather than folded into the large types/index.ts,
// same modularity pattern as types/auth.ts.

import type { User } from "./auth";

export type MemberStatus = "active" | "invited" | "suspended" | "removed";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired" | "revoked";

export type ProjectVisibility = "private" | "team" | "public";

export type ProjectType =
  | "personal"
  | "hackathon"
  | "college_project"
  | "startup"
  | "research"
  | "open_source"
  | "freelance";

// ---------- Permissions ----------

export interface Permission {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

export interface PermissionInput {
  key: string;
  name: string;
  description?: string;
  category?: string;
}

// ---------- Roles ----------

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  project_id: string | null;
  permission_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface RoleInput {
  name: string;
  description?: string;
  is_system?: boolean;
  project_id?: string | null;
  permission_keys?: string[];
}

// ---------- Project Members ----------

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_id: string | null;
  status: MemberStatus;
  invitation_accepted: boolean;
  permission_overrides: string[];
  joined_at: string;
  last_active_at: string | null;
}

export interface ProjectMemberInput {
  project_id: string;
  user_id: string;
  role_id?: string | null;
  status?: MemberStatus;
  invitation_accepted?: boolean;
  permission_overrides?: string[];
}

export interface ProjectMemberUpdateInput {
  role_id?: string | null;
  status?: MemberStatus;
  invitation_accepted?: boolean;
  permission_overrides?: string[];
}

// A ProjectMember row joined with its User for display purposes --
// built client-side (the backend keeps membership and identity as
// separate rows/routers), same idea as ProjectSummary being a computed
// rollup rather than a stored row.
export interface ProjectMemberWithUser extends ProjectMember {
  user?: User;
  role?: Role | null;
}

// ---------- Project Invitations ----------

// What kind of identifier `ProjectInvitation.email` / `ProjectInvitationInput.email`
// was resolved from -- picked via the Email/Username dropdown in
// InviteMemberDialog. Determines whether the backend matches the typed
// value against User.email or User.username (never both).
export type InvitationIdentifierType = "email" | "username";

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role_id: string | null;
  invited_by_user_id: string | null;
  token: string;
  status: InvitationStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ProjectInvitationInput {
  project_id: string;
  email: string;
  identifier_type?: InvitationIdentifierType;
  role_id?: string | null;
  expires_at: string;
}

// Public, token-scoped preview shown on the /invite/{token} landing page
// -- see backend schemas.InvitationPreviewOut.
export interface InvitationPreview extends ProjectInvitation {
  project_name: string;
  project_icon: string;
  project_color: string;
  invited_by_name: string | null;
  role_name: string | null;
}

// ---------- Collaboration: Aggregate Summary ----------

export interface ProjectCollaborationSummary {
  project_id: string;
  member_count: number;
  active_member_count: number;
  pending_invitation_count: number;
  owner: User | null;
}
