import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const PROJECT_ANALYTICS_KEY = ["project-analytics"] as const;
export const WORKSPACE_ANALYTICS_KEY = ["workspace-analytics"] as const;

export function useProjectAnalytics(projectId: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_ANALYTICS_KEY, projectId],
    queryFn: () => api.getProjectAnalytics(projectId as string),
    enabled: !!projectId,
  });
}

export function useWorkspaceAnalytics(includeArchived?: boolean) {
  return useQuery({
    queryKey: [...WORKSPACE_ANALYTICS_KEY, includeArchived ?? false],
    queryFn: () => api.getWorkspaceAnalytics(includeArchived),
  });
}
