import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimetableSlotInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

const TIMETABLE_KEY = ["timetable"] as const;

export function useTimetable() {
  return useQuery({ queryKey: TIMETABLE_KEY, queryFn: api.getTimetable });
}

export function useCreateSlot() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: TimetableSlotInput) => api.createSlot(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Class added to timetable", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't add slot", "error"),
  });
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TimetableSlotInput> }) =>
      api.updateSlot(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => toast(err.message || "Couldn't update slot", "error"),
  });
}

export function useDeleteSlot() {
  const qc = useQueryClient();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteSlot(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Removed from timetable", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove slot", "error"),
  });
}
