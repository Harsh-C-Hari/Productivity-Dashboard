import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StudySessionStartInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { STUDY_HUB_SUMMARY_KEY } from "./useStudyHub";

export const STUDY_SESSIONS_KEY = ["study-sessions"] as const;

export function useStudySessions(params?: {
  subjectId?: string;
  assignmentId?: string;
  activeOnly?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...STUDY_SESSIONS_KEY, params ?? {}],
    queryFn: () => api.getStudySessions(params),
  });
}

/** Polls for a currently-running session (ended_at is null) so a timer
 * that was started elsewhere (e.g. another tab) still shows up here. */
export function useActiveStudySession() {
  return useQuery({
    queryKey: [...STUDY_SESSIONS_KEY, "active"],
    queryFn: () => api.getStudySessions({ activeOnly: true, limit: 1 }),
    select: (sessions) => sessions[0] ?? null,
    refetchInterval: 15_000,
  });
}

function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: STUDY_SESSIONS_KEY });
    qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useStartStudySession() {
  const invalidate = useInvalidateSessions();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: StudySessionStartInput) => api.startStudySession(payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't start session", "error"),
  });
}

export function useUpdateStudySession() {
  const invalidate = useInvalidateSessions();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { ended_at?: string; duration_minutes?: number; notes?: string; complete_now?: boolean };
    }) => api.updateStudySession(id, payload),
    onSuccess: (session, variables) => {
      invalidate();
      if (variables.payload.complete_now) {
        toast(`Logged a ${session.duration_minutes}-minute session`, "success");
      }
    },
    onError: (err: Error) => toast(err.message || "Couldn't update session", "error"),
  });
}

export function useDeleteStudySession() {
  const invalidate = useInvalidateSessions();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteStudySession(id),
    onSuccess: () => {
      invalidate();
      toast("Session removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove session", "error"),
  });
}
