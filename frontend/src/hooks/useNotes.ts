import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NoteInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { STUDY_HUB_SUMMARY_KEY } from "./useStudyHub";

export const NOTES_KEY = ["notes"] as const;

export function useNotes(params?: { subjectId?: string; topicId?: string; q?: string }) {
  return useQuery({
    queryKey: [...NOTES_KEY, params ?? {}],
    queryFn: () => api.getNotes(params),
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: [...NOTES_KEY, id],
    queryFn: () => api.getNote(id as string),
    enabled: !!id,
  });
}

function useInvalidateNotes() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: NOTES_KEY });
    qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
  };
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: NoteInput) => api.createNote(payload),
    onSuccess: (note) => {
      invalidate();
      toast(`Added note "${note.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create note", "error"),
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<NoteInput> & { clear_topic?: boolean } }) =>
      api.updateNote(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update note", "error"),
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => {
      invalidate();
      toast("Note deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete note", "error"),
  });
}

export function useUploadNoteAttachment() {
  const invalidate = useInvalidateNotes();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.uploadNoteAttachment(id, file),
    onSuccess: () => {
      invalidate();
      toast("File attached", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't upload attachment", "error"),
  });
}

export function useDeleteNoteAttachment() {
  const invalidate = useInvalidateNotes();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) => api.deleteNoteAttachment(id, filename),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't remove attachment", "error"),
  });
}
