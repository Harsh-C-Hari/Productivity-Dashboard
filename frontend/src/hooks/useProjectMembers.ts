import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MemberStatus, ProjectMemberInput, ProjectMemberUpdateInput } from "@/types/collaboration";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { useProject, PROJECTS_KEY } from "./useProjects";
import { useRoles } from "./useRoles";

export const PROJECT_MEMBERS_KEY = ["project-members"] as const;

export function useProjectMembers(projectId: string | undefined, params?: { status?: MemberStatus; roleId?: string }) {
  return useQuery({
    queryKey: [...PROJECT_MEMBERS_KEY, projectId, params ?? {}],
    queryFn: () => api.getProjectMembers(projectId as string, params),
    enabled: !!projectId,
    meta: { projectId },
    // Accepting an invitation invalidates this query in the *accepting*
    // user's own session (see hooks/useProjectInvitations.ts /
    // pages/InvitationLanding.tsx / NotificationRow.tsx), but an admin
    // watching the Team tab in a different session has no way to learn
    // about that -- there's no websocket/push layer here. Poll modestly
    // while this is mounted so a newly-accepted member shows up on its
    // own within a few seconds instead of waiting for staleTime + a
    // window blur/refocus cycle. React Query automatically pauses this
    // while the tab is backgrounded (refetchIntervalInBackground defaults
    // to false), so it's not polling when nobody's looking at it.
    refetchInterval: 10_000,
  });
}

export function useProjectCollaborationSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_MEMBERS_KEY, projectId, "summary"],
    queryFn: () => api.getProjectCollaborationSummary(projectId as string),
    enabled: !!projectId,
    meta: { projectId },
    refetchInterval: 10_000,
  });
}

function useInvalidateProjectMembers(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...PROJECT_MEMBERS_KEY, projectId] });
    // Ownership transfer / role changes can affect the project's own
    // owner_id, so the project record itself needs a refresh too.
    qc.invalidateQueries({ queryKey: [...PROJECTS_KEY, projectId] });
  };
}

export function useAddProjectMember(projectId: string) {
  const invalidate = useInvalidateProjectMembers(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: Omit<ProjectMemberInput, "project_id">) =>
      api.addProjectMember(projectId, { ...payload, project_id: projectId }),
    onSuccess: () => {
      invalidate();
      toast("Member added", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't add member", "error"),
  });
}

export function useUpdateProjectMember(projectId: string) {
  const invalidate = useInvalidateProjectMembers(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: ProjectMemberUpdateInput }) =>
      api.updateProjectMember(projectId, memberId, payload),
    onSuccess: () => {
      invalidate();
      toast("Member updated", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't update member", "error"),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const invalidate = useInvalidateProjectMembers(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (memberId: string) => api.removeProjectMember(projectId, memberId),
    onSuccess: () => {
      invalidate();
      toast("Member removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove member", "error"),
  });
}

export function useTransferProjectOwnership(projectId: string) {
  const invalidate = useInvalidateProjectMembers(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (newOwnerUserId: string) => api.transferProjectOwnership(projectId, newOwnerUserId),
    onSuccess: () => {
      invalidate();
      toast("Ownership transferred", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't transfer ownership", "error"),
  });
}

export function useLeaveProject(projectId: string) {
  const invalidate = useInvalidateProjectMembers(projectId);
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (userId: string) => api.leaveProject(projectId, userId),
    onSuccess: () => {
      invalidate();
      toast("You left the project", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't leave project", "error"),
  });
}

/** Resolves the signed-in user's own membership/role/effective
 * permissions for a project, client-side, purely to decide which
 * actions to *show* in the UI -- actual enforcement always happens on
 * the backend (`require_permission`/`require_owner` in
 * auth_dependencies.py), per the "never duplicate backend permission
 * logic" architectural rule. Hiding a button here is a UX nicety, not
 * a security boundary. */
export function useCurrentMembership(projectId: string | undefined) {
  const { user } = useAuth();
  const { data: project } = useProject(projectId);
  const { data: members } = useProjectMembers(projectId);
  const { data: roles } = useRoles({ projectId, includeGlobal: true });

  const member = members?.find((m) => m.user_id === user?.id);
  const role = member?.role_id ? roles?.find((r) => r.id === member.role_id) : undefined;
  const isOwner = !!project && !!user && project.owner_id === user.id;
  const isAdmin = isOwner || role?.name === "Admin";
  const effectivePermissions = new Set<string>([...(role?.permission_keys ?? []), ...(member?.permission_overrides ?? [])]);
  const hasPermission = (key: string) => isOwner || effectivePermissions.has(key);

  return { member, role, isOwner, isAdmin, hasPermission };
}
