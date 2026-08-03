import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectPhaseInput, PhaseStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { DASHBOARD_KEY } from "./useTasks";

export const PHASES_KEY = ["phases"] as const;

export function usePhases(params?: { projectId?: string; status?: PhaseStatus }) {
  return useQuery({
    queryKey: [...PHASES_KEY, params ?? {}],
    queryFn: () => api.getPhases(params),
    enabled: params?.projectId !== undefined,
    meta: { projectId: params?.projectId },
  });
}

export function usePhaseSummary(id: string | undefined) {
  return useQuery({
    queryKey: [...PHASES_KEY, id, "summary"],
    queryFn: () => api.getPhaseSummary(id as string),
    enabled: !!id,
  });
}

/** Phases roll up into project progress/summary widgets, so project
 * queries are invalidated alongside the phase list itself. */
function useInvalidatePhases() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PHASES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreatePhase() {
  const invalidate = useInvalidatePhases();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ProjectPhaseInput) => api.createPhase(payload),
    onSuccess: (phase) => {
      invalidate();
      toast(`Added phase "${phase.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create phase", "error"),
  });
}

export function useUpdatePhase() {
  const invalidate = useInvalidatePhases();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectPhaseInput> }) =>
      api.updatePhase(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update phase", "error"),
  });
}

export function useReorderPhases() {
  const invalidate = useInvalidatePhases();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (items: { id: string; order_index: number }[]) => api.reorderPhases(items),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't reorder phases", "error"),
  });
}

export function useDeletePhase() {
  const invalidate = useInvalidatePhases();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deletePhase(id),
    onSuccess: () => {
      invalidate();
      toast("Phase removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove phase", "error"),
  });
}
