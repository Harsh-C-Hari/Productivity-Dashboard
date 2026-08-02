import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectDocumentInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";

export const PROJECT_DOCUMENTS_KEY = ["project-documents"] as const;

export function useProjectDocuments(params?: { projectId?: string; q?: string }) {
  return useQuery({
    queryKey: [...PROJECT_DOCUMENTS_KEY, params ?? {}],
    queryFn: () => api.getProjectDocuments(params),
    enabled: params?.projectId !== undefined,
  });
}

export function useProjectDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_DOCUMENTS_KEY, id],
    queryFn: () => api.getProjectDocument(id as string),
    enabled: !!id,
  });
}

function useInvalidateProjectDocuments() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECT_DOCUMENTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
  };
}

export function useCreateProjectDocument() {
  const invalidate = useInvalidateProjectDocuments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ProjectDocumentInput) => api.createProjectDocument(payload),
    onSuccess: (doc) => {
      invalidate();
      toast(`Added "${doc.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create document", "error"),
  });
}

export function useUpdateProjectDocument() {
  const invalidate = useInvalidateProjectDocuments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectDocumentInput> }) =>
      api.updateProjectDocument(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update document", "error"),
  });
}

export function useDeleteProjectDocument() {
  const invalidate = useInvalidateProjectDocuments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteProjectDocument(id),
    onSuccess: () => {
      invalidate();
      toast("Document deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete document", "error"),
  });
}
