import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FeatureInput, FeatureStatus, Priority } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { PHASES_KEY } from "./usePhases";
import { DASHBOARD_KEY } from "./useTasks";

export const FEATURES_KEY = ["features"] as const;

export function useFeatures(params?: {
  projectId?: string;
  phaseId?: string;
  status?: FeatureStatus;
  priority?: Priority;
  q?: string;
  sortBy?: "created_at" | "updated_at" | "priority" | "progress" | "title";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...FEATURES_KEY, params ?? {}],
    queryFn: () => api.getFeatures(params),
    enabled: params?.projectId !== undefined,
    meta: { projectId: params?.projectId },
  });
}

export function useFeature(id: string | undefined) {
  return useQuery({
    queryKey: [...FEATURES_KEY, id],
    queryFn: () => api.getFeature(id as string),
    enabled: !!id,
  });
}

function useInvalidateFeatures() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: FEATURES_KEY });
    qc.invalidateQueries({ queryKey: PHASES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateFeature() {
  const invalidate = useInvalidateFeatures();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: FeatureInput) => api.createFeature(payload),
    onSuccess: (feature) => {
      invalidate();
      toast(`Added "${feature.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create feature", "error"),
  });
}

export function useUpdateFeature() {
  const invalidate = useInvalidateFeatures();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<FeatureInput> & { clear_phase?: boolean };
    }) => api.updateFeature(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update feature", "error"),
  });
}

export function useDeleteFeature() {
  const invalidate = useInvalidateFeatures();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteFeature(id),
    onSuccess: () => {
      invalidate();
      toast("Feature deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete feature", "error"),
  });
}
