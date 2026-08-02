import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InvitationStatus, ProjectInvitationInput } from "@/types/collaboration";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECT_MEMBERS_KEY } from "./useProjectMembers";

export const PROJECT_INVITATIONS_KEY = ["project-invitations"] as const;

export function useProjectInvitations(projectId: string | undefined, status?: InvitationStatus) {
  return useQuery({
    queryKey: [...PROJECT_INVITATIONS_KEY, projectId, status ?? "all"],
    queryFn: () => api.getProjectInvitations(projectId as string, status),
    enabled: !!projectId,
  });
}

function useInvalidateInvitations(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...PROJECT_INVITATIONS_KEY, projectId] });
    // Pending invitation count feeds the collaboration summary.
    qc.invalidateQueries({ queryKey: [...PROJECT_MEMBERS_KEY, projectId] });
  };
}

export function useCreateProjectInvitation(projectId: string) {
  const invalidate = useInvalidateInvitations(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: Omit<ProjectInvitationInput, "project_id">) =>
      api.createProjectInvitation(projectId, payload),
    onSuccess: (invitation) => {
      invalidate();
      toast(`Invited ${invitation.email}`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't send invitation", "error"),
  });
}

export function useCancelProjectInvitation(projectId: string) {
  const invalidate = useInvalidateInvitations(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (invitationId: string) => api.cancelProjectInvitation(projectId, invitationId),
    onSuccess: () => {
      invalidate();
      toast("Invitation cancelled", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't cancel invitation", "error"),
  });
}

export function useExpireProjectInvitation(projectId: string) {
  const invalidate = useInvalidateInvitations(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (invitationId: string) => api.expireProjectInvitation(projectId, invitationId),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't expire invitation", "error"),
  });
}

export function useResendProjectInvitation(projectId: string) {
  const invalidate = useInvalidateInvitations(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (invitationId: string) => api.resendProjectInvitation(projectId, invitationId),
    onSuccess: (invitation) => {
      invalidate();
      toast(`Invitation to ${invitation.email} refreshed`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't resend invitation", "error"),
  });
}
