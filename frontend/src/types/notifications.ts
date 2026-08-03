// Notification Center types -- mirrors backend/app/schemas.py's
// "---------- Notifications ----------" section. Kept in its own file,
// same modularity pattern as types/auth.ts and types/collaboration.ts.

export type NotificationCategory =
  | "project_invitation"
  | "invitation_accepted"
  | "invitation_rejected"
  | "invitation_cancelled"
  | "task_reminder"
  | "task_overdue"
  | "study_reminder"
  | "ai_workspace"
  | "project_update"
  | "member_joined"
  | "member_left"
  | "project_access_revoked"
  | "role_changed"
  | "system";

export interface Notification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  project_id: string | null;
  invitation_id: string | null;
  action_url: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationCounts {
  unread: number;
  total: number;
  pending_invitations: number;
}
