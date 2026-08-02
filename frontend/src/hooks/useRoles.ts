import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RoleInput } from "@/types/collaboration";
import { useNotifications } from "@/context/NotificationContext";

export const ROLES_KEY = ["roles"] as const;

export function useRoles(params?: { projectId?: string; includeGlobal?: boolean }) {
  return useQuery({
    queryKey: [...ROLES_KEY, params ?? {}],
    queryFn: () => api.getRoles(params),
  });
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: [...ROLES_KEY, id],
    queryFn: () => api.getRole(id as string),
    enabled: !!id,
  });
}

function useInvalidateRoles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROLES_KEY });
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: RoleInput) => api.createRole(payload),
    onSuccess: (role) => {
      invalidate();
      toast(`Created role "${role.name}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create role", "error"),
  });
}

export function useUpdateRole() {
  const invalidate = useInvalidateRoles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RoleInput> }) => api.updateRole(id, payload),
    onSuccess: () => {
      invalidate();
      toast("Role updated", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't update role", "error"),
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteRole(id),
    onSuccess: () => {
      invalidate();
      toast("Role deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete role", "error"),
  });
}

export function useAddRolePermissions() {
  const invalidate = useInvalidateRoles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: string[] }) => api.addRolePermissions(id, keys),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update permissions", "error"),
  });
}

export function useRemoveRolePermissions() {
  const invalidate = useInvalidateRoles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: string[] }) => api.removeRolePermissions(id, keys),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update permissions", "error"),
  });
}
