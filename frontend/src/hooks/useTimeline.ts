import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimelineEventInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { DASHBOARD_KEY } from "./useTasks";

export const TIMELINE_KEY = ["timeline"] as const;

export function useTimelineEvents(params?: {
  projectId?: string;
  eventType?: string;
  relatedEntityType?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...TIMELINE_KEY, params ?? {}],
    queryFn: () => api.getTimelineEvents(params),
    enabled: params?.projectId !== undefined,
  });
}

function useInvalidateTimeline() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: TIMELINE_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateTimelineEvent() {
  const invalidate = useInvalidateTimeline();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: TimelineEventInput) => api.createTimelineEvent(payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't add timeline event", "error"),
  });
}

export function useDeleteTimelineEvent() {
  const invalidate = useInvalidateTimeline();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteTimelineEvent(id),
    onSuccess: () => {
      invalidate();
      toast("Timeline event removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove event", "error"),
  });
}
