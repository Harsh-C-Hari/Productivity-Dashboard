import {
  Mail,
  UserCheck,
  UserX,
  MailX,
  Clock,
  AlarmClock,
  BookOpen,
  Bot,
  FolderKanban,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { NotificationCategory } from "@/types/notifications";

interface NotificationCategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string; // icon bg/text classes, same shape as collaborationMeta's StatusMeta
}

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, NotificationCategoryMeta> = {
  project_invitation: { label: "Project Invitation", icon: Mail, color: "bg-secondary/15 text-secondary" },
  invitation_accepted: { label: "Invitation Accepted", icon: UserCheck, color: "bg-urgency-low/15 text-urgency-low" },
  invitation_rejected: { label: "Invitation Rejected", icon: UserX, color: "bg-urgency-critical/15 text-urgency-critical" },
  invitation_cancelled: { label: "Invitation Cancelled", icon: MailX, color: "bg-white/10 text-muted-foreground" },
  task_reminder: { label: "Task Reminder", icon: Clock, color: "bg-primary/15 text-primary" },
  task_overdue: { label: "Task Overdue", icon: AlarmClock, color: "bg-urgency-critical/15 text-urgency-critical" },
  study_reminder: { label: "Study Reminder", icon: BookOpen, color: "bg-accent/15 text-accent" },
  ai_workspace: { label: "AI Workspace", icon: Bot, color: "bg-primary/15 text-primary" },
  project_update: { label: "Project Update", icon: FolderKanban, color: "bg-secondary/15 text-secondary" },
  member_joined: { label: "Member Joined", icon: UserPlus, color: "bg-urgency-low/15 text-urgency-low" },
  member_left: { label: "Member Left", icon: UserMinus, color: "bg-white/10 text-muted-foreground" },
  role_changed: { label: "Role Changed", icon: ShieldCheck, color: "bg-secondary/15 text-secondary" },
  system: { label: "System", icon: Bell, color: "bg-white/10 text-muted-foreground" },
};

export const NOTIFICATION_CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = (
  Object.keys(NOTIFICATION_CATEGORY_META) as NotificationCategory[]
).map((value) => ({ value, label: NOTIFICATION_CATEGORY_META[value].label }));
