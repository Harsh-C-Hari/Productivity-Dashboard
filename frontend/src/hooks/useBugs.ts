import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BugInput, BugSeverity, BugStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { PHASES_KEY } from "./usePhases";
import { FEATURES_KEY } from "./useFeatures";
import { DASHBOARD_KEY } from "./useTasks";

export const BUGS_KEY = ["bugs"] as const;

export function useBugs(params?: {
  projectId?: string;
  phaseId?: string;
  featureId?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  q?: string;
  sortBy?: "created_at" | "updated_at" | "severity" | "title";
  sortOrder?: "asc" | "desc";
  limit?: number;
}) {
  return useQuery({
    queryKey: [...BUGS_KEY, params ?? {}],
    queryFn: () => api.getBugs(params),
    meta: { projectId: params?.projectId },
  });
}

export function useBug(id: string | undefined) {
  return useQuery({
    queryKey: [...BUGS_KEY, id],
    queryFn: () => api.getBug(id as string),
    enabled: !!id,
  });
}

function useInvalidateBugs() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: BUGS_KEY });
    qc.invalidateQueries({ queryKey: PHASES_KEY });
    qc.invalidateQueries({ queryKey: FEATURES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateBug() {
  const invalidate = useInvalidateBugs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: BugInput) => api.createBug(payload),
    onSuccess: (bug) => {
      invalidate();
      toast(`Reported "${bug.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't report bug", "error"),
  });
}

export function useUpdateBug() {
  const invalidate = useInvalidateBugs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<BugInput> & { clear_phase?: boolean; clear_feature?: boolean };
    }) => api.updateBug(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update bug", "error"),
  });
}

export function useDeleteBug() {
  const invalidate = useInvalidateBugs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteBug(id),
    onSuccess: () => {
      invalidate();
      toast("Bug deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete bug", "error"),
  });
}
