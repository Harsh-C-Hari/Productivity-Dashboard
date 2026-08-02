import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssignmentInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { STUDY_HUB_SUMMARY_KEY } from "./useStudyHub";

export const ASSIGNMENTS_KEY = ["assignments"] as const;

export function useAssignments(params?: { subjectId?: string; topicId?: string; status?: string }) {
  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, params ?? {}],
    queryFn: () => api.getAssignments(params),
  });
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, id],
    queryFn: () => api.getAssignment(id as string),
    enabled: !!id,
  });
}

/** Assignment changes ripple into the Study Hub summary and the main
 * dashboard (upcoming/overdue widgets, subject progress), so both are
 * invalidated alongside the assignment list itself. */
function useInvalidateAssignments() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
    qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateAssignment() {
  const invalidate = useInvalidateAssignments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: AssignmentInput) => api.createAssignment(payload),
    onSuccess: (assignment) => {
      invalidate();
      toast(`Added "${assignment.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create assignment", "error"),
  });
}

export function useUpdateAssignment() {
  const invalidate = useInvalidateAssignments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AssignmentInput> & { clear_deadline?: boolean; clear_topic?: boolean };
    }) => api.updateAssignment(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update assignment", "error"),
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidateAssignments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteAssignment(id),
    onSuccess: () => {
      invalidate();
      toast("Assignment deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete assignment", "error"),
  });
}

export function useUploadAssignmentAttachment() {
  const invalidate = useInvalidateAssignments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.uploadAssignmentAttachment(id, file),
    onSuccess: () => {
      invalidate();
      toast("File attached", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't upload attachment", "error"),
  });
}

export function useDeleteAssignmentAttachment() {
  const invalidate = useInvalidateAssignments();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      api.deleteAssignmentAttachment(id, filename),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't remove attachment", "error"),
  });
}
