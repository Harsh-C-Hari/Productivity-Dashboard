import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MilestoneInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { PHASES_KEY } from "./usePhases";
import { DASHBOARD_KEY } from "./useTasks";

export const MILESTONES_KEY = ["milestones"] as const;

export function useMilestones(params?: {
  projectId?: string;
  phaseId?: string;
  completed?: boolean;
  q?: string;
  sortBy?: "target_date" | "created_at" | "title";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...MILESTONES_KEY, params ?? {}],
    queryFn: () => api.getMilestones(params),
    enabled: params?.projectId !== undefined,
  });
}

export function useMilestone(id: string | undefined) {
  return useQuery({
    queryKey: [...MILESTONES_KEY, id],
    queryFn: () => api.getMilestone(id as string),
    enabled: !!id,
  });
}

function useInvalidateMilestones() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: MILESTONES_KEY });
    qc.invalidateQueries({ queryKey: PHASES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateMilestone() {
  const invalidate = useInvalidateMilestones();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: MilestoneInput) => api.createMilestone(payload),
    onSuccess: (milestone) => {
      invalidate();
      toast(`Added milestone "${milestone.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create milestone", "error"),
  });
}

export function useUpdateMilestone() {
  const invalidate = useInvalidateMilestones();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<MilestoneInput> & {
        clear_target_date?: boolean;
        clear_phase?: boolean;
        complete_now?: boolean;
      };
    }) => api.updateMilestone(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update milestone", "error"),
  });
}

export function useDeleteMilestone() {
  const invalidate = useInvalidateMilestones();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteMilestone(id),
    onSuccess: () => {
      invalidate();
      toast("Milestone removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove milestone", "error"),
  });
}
