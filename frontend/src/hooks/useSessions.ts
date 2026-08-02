import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";

export const SESSIONS_KEY = ["auth", "sessions"] as const;

export function useSessions() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api.getSessions() });
}

function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SESSIONS_KEY });
}

export function useRevokeSession() {
  const invalidate = useInvalidateSessions();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSuccess: () => {
      invalidate();
      toast("Session signed out", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't sign out that session", "error"),
  });
}

export function useRevokeOtherSessions() {
  const invalidate = useInvalidateSessions();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: () => api.revokeOtherSessions(),
    onSuccess: () => {
      invalidate();
      toast("Signed out of every other device", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't sign out other devices", "error"),
  });
}

/** Logs out *every* device, including this one -- so unlike the other
 * mutations here, it also has to tear down this tab's own session via
 * AuthContext.logout() rather than just invalidating the sessions list. */
export function useLogoutAllDevices() {
  const { toast } = useNotifications();
  const { logout } = useAuth();
  return useMutation({
    mutationFn: () => api.logoutAllDevices(),
    onSuccess: async () => {
      toast("Signed out of every device", "success");
      await logout();
    },
    onError: (err: Error) => toast(err.message || "Couldn't sign out of all devices", "error"),
  });
}
