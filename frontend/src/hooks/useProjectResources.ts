import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectResourceLinkInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";

export const PROJECT_RESOURCES_KEY = ["project-resources"] as const;

export function useProjectResources(params?: { projectId?: string; resourceType?: string }) {
  return useQuery({
    queryKey: [...PROJECT_RESOURCES_KEY, params ?? {}],
    queryFn: () => api.getProjectResources(params),
    enabled: params?.projectId !== undefined,
  });
}

function useInvalidateProjectResources() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECT_RESOURCES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
  };
}

export function useCreateProjectResourceLink() {
  const invalidate = useInvalidateProjectResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ProjectResourceLinkInput) => api.createProjectResourceLink(payload),
    onSuccess: (resource) => {
      invalidate();
      toast(`Added link "${resource.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't add link", "error"),
  });
}

export function useUploadProjectResourceFile() {
  const invalidate = useInvalidateProjectResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (params: { projectId: string; title: string; file: File }) =>
      api.uploadProjectResourceFile(params),
    onSuccess: (resource) => {
      invalidate();
      toast(`Uploaded "${resource.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't upload file", "error"),
  });
}

export function useUpdateProjectResource() {
  const invalidate = useInvalidateProjectResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { title?: string; external_url?: string } }) =>
      api.updateProjectResource(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update resource", "error"),
  });
}

export function useDeleteProjectResource() {
  const invalidate = useInvalidateProjectResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteProjectResource(id),
    onSuccess: () => {
      invalidate();
      toast("Resource removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove resource", "error"),
  });
}
