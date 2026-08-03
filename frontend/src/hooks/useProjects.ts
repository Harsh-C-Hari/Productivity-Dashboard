import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectInput, ProjectStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { DASHBOARD_KEY } from "./useTasks";

export const PROJECTS_KEY = ["projects"] as const;
export const PROJECT_WORKSPACE_SUMMARY_KEY = ["projects", "workspace-summary"] as const;

export function useProjects(params?: {
  status?: ProjectStatus;
  archived?: boolean;
  q?: string;
  tag?: string;
  sortBy?: "name" | "created_at" | "updated_at" | "progress";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, params ?? {}],
    queryFn: () => api.getProjects(params),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: () => api.getProject(id as string),
    enabled: !!id,
    meta: { projectId: id },
  });
}

export function useProjectSummary(id: string | undefined) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, id, "summary"],
    queryFn: () => api.getProjectSummary(id as string),
    enabled: !!id,
    meta: { projectId: id },
  });
}

export function useWorkspaceSummary() {
  return useQuery({
    queryKey: PROJECT_WORKSPACE_SUMMARY_KEY,
    queryFn: () => api.getWorkspaceSummary(),
    refetchInterval: 60_000,
  });
}

export function useProjectWorkspaceSearch(query: string) {
  return useQuery({
    queryKey: ["projects", "search", query],
    queryFn: () => api.searchProjectWorkspace(query),
    enabled: query.trim().length > 1,
  });
}

/** Project changes ripple into every Project Workspace summary/list and
 * the main dashboard (projects_progress, upcoming_milestones, overdue
 * todos, recent timeline widgets), so all are invalidated together --
 * the same pattern used for Subjects. */
function useInvalidateProjects() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    qc.invalidateQueries({ queryKey: PROJECT_WORKSPACE_SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ProjectInput) => api.createProject(payload),
    onSuccess: (project) => {
      invalidate();
      toast(`Created "${project.name}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create project", "error"),
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectInput> }) =>
      api.updateProject(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update project", "error"),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      invalidate();
      toast("Project and everything in it removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete project", "error"),
  });
}
