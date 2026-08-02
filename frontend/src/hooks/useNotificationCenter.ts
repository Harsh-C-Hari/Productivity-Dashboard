import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNotifications as useToast } from "@/context/NotificationContext";
import type { NotificationCategory } from "@/types/notifications";

// Named distinctly from context/NotificationContext.tsx's `useNotifications`
// (that one is the toast/browser-notification-permission context; this file
// is the persisted, server-backed Notification Center data layer). Aliased
// on import above to `useToast` to make every call site's intent obvious.

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const NOTIFICATION_COUNTS_KEY = ["notifications", "counts"] as const;

export function useNotificationsList(params?: { is_read?: boolean; category?: NotificationCategory; search?: string }) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, params ?? {}],
    queryFn: () => api.getNotifications(params),
    // Notifications can arrive from another tab/session; poll gently so an
    // open Notification Center / sidebar badge doesn't go stale for long.
    refetchInterval: 30_000,
  });
}

export function useNotificationCounts() {
  return useQuery({
    queryKey: NOTIFICATION_COUNTS_KEY,
    queryFn: () => api.getNotificationCounts(),
    refetchInterval: 30_000,
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationUnread() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationUnread(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      invalidate();
      toast("All notifications marked as read", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't mark notifications as read", "error"),
  });
}

export function useDeleteNotification() {
  const invalidate = useInvalidateNotifications();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => {
      invalidate();
      toast("Notification deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete notification", "error"),
  });
}
