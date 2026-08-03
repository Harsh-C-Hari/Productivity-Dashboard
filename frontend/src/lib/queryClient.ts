import { QueryClient, QueryCache, MutationCache, type QueryKey } from "@tanstack/react-query";
import { ApiError } from "./api";
import { emitProjectAccessLost } from "./projectAccessClient";

// Any hook that fetches/mutates data scoped to one project tags its
// query/mutation with this so the global caches below know which project
// a 403/404 belongs to (see e.g. hooks/useProjectTodos.ts, useBugs.ts,
// etc.). Most of these endpoints don't carry the project id in their URL
// (e.g. `/api/todos/:id`, not `/api/projects/:id/todos/:id`), so the URL
// alone isn't enough to recover it -- this is the one bit of per-hook
// plumbing the centralized handling below relies on.
export interface ProjectScopedMeta {
  projectId?: string;
  [key: string]: unknown;
}

function isProjectAccessError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

/** True if this cached query's data belongs to `projectId` -- either it
 * was explicitly tagged (`meta.projectId`), or the id simply shows up
 * somewhere in its key (covers `["projects", id]`, `["project-members",
 * id, ...]`, etc. without needing every single key shape enumerated). */
function belongsToProject(queryKey: QueryKey, meta: unknown, projectId: string): boolean {
  if ((meta as ProjectScopedMeta | undefined)?.projectId === projectId) return true;
  try {
    return JSON.stringify(queryKey).includes(projectId);
  } catch {
    return false;
  }
}

/** Single choke point for "the user just lost access to a project":
 * drops every cached query for that project (so no stale data can flash
 * back on screen from cache while components unmount/re-render), and
 * refreshes the general projects list so every "pick a project" dropdown
 * app-wide (filters, the Upload ZIP form, the New Handoff form, etc.)
 * naturally stops offering it as an option once the list refetches --
 * rather than each dropdown needing its own filtering logic. Then lets
 * React-facing code (AppLayout's listener, any component with its own
 * "selected project" filter) react via the event bus. Called from both
 * the QueryCache and MutationCache `onError` below, so it fires whether
 * the access loss was discovered by a background refetch or by the user
 * trying to act on stale data. */
function handleProjectAccessLost(projectId: string) {
  queryClient.removeQueries({
    predicate: (query) => belongsToProject(query.queryKey, query.meta, projectId),
  });
  // The plain `useProjects()` list query's key is `["projects", params]`
  // (params being a filter object, not this project's id), so it isn't
  // caught by `belongsToProject` above and needs invalidating separately.
  // Match on shape (key[0] === "projects" && key[1] is a params object)
  // rather than by id, since that's exactly what distinguishes the list
  // query from `useProject(id)` / `useProjectSummary(id)` / etc., whose
  // second key segment is the id itself.
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return key[0] === "projects" && typeof key[1] === "object" && key[1] !== null;
    },
  });
  emitProjectAccessLost(projectId);
}

// Pulled out of App.tsx into its own module (rather than defined inline
// in the component) so `AuthContext.tsx` can import it too, without a
// circular dependency (App.tsx renders AuthProvider, so AuthProvider
// can't import the client back out of App.tsx). AuthContext calls
// `queryClient.clear()` on logout -- see its `clearSession` -- so no
// other user's cached data (dashboard widgets, project data, Study Hub,
// AI Workspace, notifications, everything React Query has cached)
// survives into the next login on a shared device.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Retrying a 401/403/404 is never useful -- the resource isn't
      // going to become authorized/found on a second try a moment later,
      // and retrying just delays the project-access-lost handling below.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && failureCount < 1,
      refetchOnWindowFocus: true,
    },
  },
  // Centralized loss-of-access detection for *queries* (GET requests) --
  // this is what catches stale cached project data (todos, bugs,
  // features, milestones, timeline, documents, resources, analytics...)
  // going stale the moment a background refetch (React Query's default
  // `refetchOnWindowFocus`/staleTime revalidation) comes back 403/404
  // after the user's project membership is revoked.
  queryCache: new QueryCache({
    onError: (error, query) => {
      const projectId = (query.meta as ProjectScopedMeta | undefined)?.projectId;
      if (projectId && isProjectAccessError(error)) handleProjectAccessLost(projectId);
    },
  }),
  // Same detection for *mutations* -- e.g. a create/update/delete fired
  // right as access is revoked, before the next background refetch would
  // have caught it.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const projectId = (mutation.meta as ProjectScopedMeta | undefined)?.projectId;
      if (projectId && isProjectAccessError(error)) handleProjectAccessLost(projectId);
    },
  }),
});
