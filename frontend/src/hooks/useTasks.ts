import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

export const TASKS_KEY = ["tasks"] as const;
export const DASHBOARD_KEY = ["dashboard"] as const;

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: api.getTasks });
}

/** Invalidate both task list and dashboard aggregate together, since
 * dashboard numbers are derived from the same underlying task data. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateAll();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: TaskInput) => api.createTask(payload),
    onSuccess: (task) => {
      invalidate();
      toast(`Added "${task.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create task", "error"),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateAll();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<TaskInput> & { clear_deadline?: boolean };
    }) => api.updateTask(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update task", "error"),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateAll();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      invalidate();
      toast("Task deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete task", "error"),
  });
}
