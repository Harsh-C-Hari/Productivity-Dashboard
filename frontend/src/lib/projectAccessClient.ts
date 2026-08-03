// Cross-module event bus for loss of project access.
//
// lib/queryClient.ts's QueryCache/MutationCache `onError` callbacks detect
// a 403/404 on a project-scoped query or mutation, but they run outside
// React (no hooks, no router) so they can't clear component state, show a
// toast, or navigate. They broadcast here instead; React-facing code
// subscribes -- primarily the single app-wide listener mounted in
// AppLayout (see hooks/useProjectAccessGuard.ts), which owns the
// centralized "toast + navigate back to /projects" behavior, plus any
// component that keeps its own local "selected project" filter (e.g. the
// AI Workspace views) and needs to drop that selection when it goes stale.

type ProjectAccessListener = (projectId: string) => void;

const listeners = new Set<ProjectAccessListener>();

/** Fired whenever a project-scoped request comes back 403/404 -- i.e. the
 * signed-in user no longer has access to that project (typically because
 * they were removed as a member). */
export function onProjectAccessLost(fn: ProjectAccessListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitProjectAccessLost(projectId: string): void {
  listeners.forEach((fn) => fn(projectId));
}
