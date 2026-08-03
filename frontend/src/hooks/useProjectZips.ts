import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";

export const PROJECT_ZIPS_KEY = ["ai-project-zips"] as const;

export function useProjectZips(params?: { projectId?: string; aiAccountId?: string; conversationId?: string }) {
  return useQuery({
    queryKey: [...PROJECT_ZIPS_KEY, params ?? {}],
    queryFn: () => api.getProjectZips(params),
    meta: { projectId: params?.projectId },
  });
}

export function useCurrentProjectZip(projectId: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_ZIPS_KEY, "current", projectId],
    queryFn: () => api.getCurrentProjectZip(projectId as string),
    enabled: !!projectId,
    retry: false,
    meta: { projectId },
  });
}

function useInvalidateProjectZips() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECT_ZIPS_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useUploadProjectZip() {
  const invalidate = useInvalidateProjectZips();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (params: {
      projectId: string;
      aiAccountId?: string;
      conversationId?: string;
      versionLabel?: string;
      notes?: string;
      file: File;
    }) => api.uploadProjectZip(params),
    onSuccess: (zip) => {
      invalidate();
      toast(`Uploaded "${zip.original_name ?? zip.version_label ?? "zip"}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't upload zip", "error"),
  });
}

export function useReplaceProjectZip() {
  const invalidate = useInvalidateProjectZips();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, file, versionLabel, notes }: { id: string; file: File; versionLabel?: string; notes?: string }) =>
      api.replaceProjectZip(id, { file, versionLabel, notes }),
    onSuccess: () => {
      invalidate();
      toast("Zip replaced", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't replace zip", "error"),
  });
}

export function useUpdateProjectZip() {
  const invalidate = useInvalidateProjectZips();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        ai_account_id?: string | null;
        conversation_id?: string | null;
        version_label?: string;
        notes?: string;
        clear_ai_account?: boolean;
        clear_conversation?: boolean;
      };
    }) => api.updateProjectZip(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update zip", "error"),
  });
}

export function useDeleteProjectZip() {
  const invalidate = useInvalidateProjectZips();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteProjectZip(id),
    onSuccess: () => {
      invalidate();
      toast("Zip deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete zip", "error"),
  });
}
