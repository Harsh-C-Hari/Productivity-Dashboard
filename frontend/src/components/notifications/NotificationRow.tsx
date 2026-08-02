import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, isPast } from "date-fns";
import { Check, Trash2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_CATEGORY_META } from "@/lib/notificationMeta";
import { useMarkNotificationRead, useDeleteNotification, NOTIFICATIONS_KEY } from "@/hooks/useNotificationCenter";
import { PROJECT_MEMBERS_KEY } from "@/hooks/useProjectMembers";
import { PROJECT_INVITATIONS_KEY } from "@/hooks/useProjectInvitations";
import { useNotifications as useToast } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import type { Notification } from "@/types/notifications";

interface NotificationRowProps {
  notification: Notification;
}

/** A single Notification Center row. Project-invitation notifications get
 * inline Accept/Reject actions (per AI_HANDOFF.md "Invitations Through
 * Notifications") calling the same token-scoped endpoints the /invite/
 * {token} landing page uses -- no email required either way. Every other
 * category just deep-links via `action_url` when clicked. */
export function NotificationRow({ notification }: NotificationRowProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();
  const meta = NOTIFICATION_CATEGORY_META[notification.category];
  const Icon = meta.icon;

  const token = notification.action_url.startsWith("/invite/")
    ? notification.action_url.replace("/invite/", "")
    : null;

  const isInvitationNotification = notification.category === "project_invitation" && !!token;

  // Live status for this invitation -- the notification itself doesn't
  // update once accepted/rejected elsewhere (e.g. via the /invite/{token}
  // landing page or the Project Members panel), so Accept/Reject here must
  // be gated on a fresh fetch rather than trusting the notification's own
  // (now potentially stale) presence.
  const { data: invitation, isLoading: invitationLoading } = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => api.getInvitationByToken(token as string),
    enabled: isInvitationNotification,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(token as string),
    onSuccess: () => {
      toast("Invitation accepted", "success");
      markRead.mutate(notification.id);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: ["invitation-preview", token] });
      if (notification.project_id) {
        qc.invalidateQueries({ queryKey: [...PROJECT_MEMBERS_KEY, notification.project_id] });
        qc.invalidateQueries({ queryKey: [...PROJECT_INVITATIONS_KEY, notification.project_id] });
      }
    },
    onError: (err: Error) => toast(err.message || "Couldn't accept invitation", "error"),
  });

  const reject = useMutation({
    mutationFn: () => api.rejectInvitation(token as string),
    onSuccess: () => {
      toast("Invitation declined", "info");
      markRead.mutate(notification.id);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: ["invitation-preview", token] });
      if (notification.project_id) {
        qc.invalidateQueries({ queryKey: [...PROJECT_INVITATIONS_KEY, notification.project_id] });
      }
    },
    onError: (err: Error) => toast(err.message || "Couldn't decline invitation", "error"),
  });

  // Only offer Accept/Reject while the invitation is still actually
  // actionable -- i.e. we've confirmed (via a live fetch, not just the
  // notification's own category) that it's still "pending" and unexpired.
  // Already accepted/rejected/expired/revoked invitations render no
  // actions at all, instead of buttons that the backend would just reject.
  const isPendingInvitation =
    isInvitationNotification &&
    !invitationLoading &&
    invitation?.status === "pending" &&
    !isPast(new Date(invitation.expires_at));

  function handleOpen() {
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.action_url && !isPendingInvitation) navigate(notification.action_url);
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
        notification.is_read
          ? "border-white/5 bg-base-900/20"
          : "border-primary/20 bg-primary/[0.04]"
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <button onClick={handleOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <p className="text-sm font-medium truncate">{notification.title}</p>
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>

        {isPendingInvitation && (
          <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => accept.mutate()}
              disabled={accept.isPending || reject.isPending}
            >
              <Mail className="h-3.5 w-3.5" /> {accept.isPending ? "Accepting…" : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => reject.mutate()}
              disabled={accept.isPending || reject.isPending}
            >
              <X className="h-3.5 w-3.5" /> {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            title="Mark read"
            onClick={() => markRead.mutate(notification.id)}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          onClick={() => deleteNotification.mutate(notification.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
