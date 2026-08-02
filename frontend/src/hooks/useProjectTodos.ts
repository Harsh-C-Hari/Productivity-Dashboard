import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectTodoInput, TaskStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { PROJECTS_KEY, PROJECT_WORKSPACE_SUMMARY_KEY } from "./useProjects";
import { PHASES_KEY } from "./usePhases";
import { FEATURES_KEY } from "./useFeatures";
import { DASHBOARD_KEY } from "./useTasks";

export const PROJECT_TODOS_KEY = ["project-todos"] as const;

export function useProjectTodos(params?: {
  projectId?: string;
  phaseId?: string;
  featureId?: string;
  status?: TaskStatus;
  q?: string;
  overdueOnly?: boolean;
  sortBy?: "deadline" | "created_at" | "updated_at" | "progress" | "title";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...PROJECT_TODOS_KEY, params ?? {}],
    queryFn: () => api.getProjectTodos(params),
    enabled: params?.projectId !== undefined,
  });
}

export function useProjectTodo(id: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_TODOS_KEY, id],
    queryFn: () => api.getProjectTodo(id as string),
    enabled: !!id,
  });
}

function useInvalidateProjectTodos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECT_TODOS_KEY });
    qc.invalidateQueries({ queryKey: PHASES_KEY });
    qc.invalidateQueries({ queryKey: FEATURES_KEY });
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateProjectTodo() {
  const invalidate = useInvalidateProjectTodos();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ProjectTodoInput) => api.createProjectTodo(payload),
    onSuccess: (todo) => {
      invalidate();
      toast(`Added "${todo.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create todo", "error"),
  });
}

export function useUpdateProjectTodo() {
  const invalidate = useInvalidateProjectTodos();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<ProjectTodoInput> & {
        clear_deadline?: boolean;
        clear_phase?: boolean;
        clear_feature?: boolean;
      };
    }) => api.updateProjectTodo(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update todo", "error"),
  });
}

export function useDeleteProjectTodo() {
  const invalidate = useInvalidateProjectTodos();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteProjectTodo(id),
    onSuccess: () => {
      invalidate();
      toast("Todo deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete todo", "error"),
  });
}
