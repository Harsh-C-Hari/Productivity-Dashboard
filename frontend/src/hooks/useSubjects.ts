import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SubjectInput, TopicInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { STUDY_HUB_SUMMARY_KEY } from "./useStudyHub";

export const SUBJECTS_KEY = ["subjects"] as const;
export const TOPICS_KEY = ["topics"] as const;

export function useSubjects() {
  return useQuery({ queryKey: SUBJECTS_KEY, queryFn: api.getSubjects });
}

export function useSubject(id: string | undefined) {
  return useQuery({
    queryKey: [...SUBJECTS_KEY, id],
    queryFn: () => api.getSubject(id as string),
    enabled: !!id,
  });
}

/** Study Hub summary and the main dashboard both derive from subjects,
 * so any subject mutation invalidates all three together. */
function useInvalidateSubjects() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: SUBJECTS_KEY });
    qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateSubject() {
  const invalidate = useInvalidateSubjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: SubjectInput) => api.createSubject(payload),
    onSuccess: (subject) => {
      invalidate();
      toast(`Added "${subject.name}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create subject", "error"),
  });
}

export function useUpdateSubject() {
  const invalidate = useInvalidateSubjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SubjectInput> }) =>
      api.updateSubject(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update subject", "error"),
  });
}

export function useDeleteSubject() {
  const invalidate = useInvalidateSubjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteSubject(id),
    onSuccess: () => {
      invalidate();
      // Assignments/notes/resources for this subject are cascade-deleted server-side.
      toast("Subject and everything in it removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete subject", "error"),
  });
}

// ---------- Topics ----------

export function useTopics(subjectId?: string) {
  return useQuery({
    queryKey: [...TOPICS_KEY, subjectId ?? "all"],
    queryFn: () => api.getTopics(subjectId),
    enabled: subjectId !== undefined,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: TopicInput) => api.createTopic(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TOPICS_KEY });
      qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
      toast("Topic added", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't add topic", "error"),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TopicInput> }) =>
      api.updateTopic(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: TOPICS_KEY }),
    onError: (err: Error) => toast(err.message || "Couldn't update topic", "error"),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TOPICS_KEY });
      qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
      toast("Topic removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove topic", "error"),
  });
}
