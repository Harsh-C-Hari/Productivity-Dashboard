import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const USERS_KEY = ["users"] as const;

/** Read-only user directory lookup. Collaboration UI (Member List,
 * Invitation "invited by", role assignment) resolves user_id -> User
 * client-side via this hook rather than the backend embedding a User
 * object on every ProjectMember/ProjectInvitation row -- keeps those
 * rows small and matches how the rest of the app treats identity as a
 * separate concern from membership. */
export function useUsers(params?: { q?: string; limit?: number }) {
  return useQuery({
    queryKey: [...USERS_KEY, params ?? {}],
    queryFn: () => api.getUsers(params),
    staleTime: 60_000,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: [...USERS_KEY, id],
    queryFn: () => api.getUser(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}
