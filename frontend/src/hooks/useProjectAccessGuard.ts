import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onProjectAccessLost } from "@/lib/projectAccessClient";
import { useNotifications } from "@/context/NotificationContext";

/** Mounted once, app-wide (see components/layout/AppLayout.tsx). This is
 * the single place that reacts to "lost access to project X" for
 * navigation purposes:
 *  - shows the "You no longer have access to this project." toast
 *  - if the user is currently looking at that project (any
 *    /projects/:id/* route, which covers every tab -- Todos, Bugs,
 *    Features, Milestones, Timeline, Documents, Resources, Analytics,
 *    Team -- since they're all rendered inside ProjectDetail rather than
 *    being separate routes), navigates back to /projects
 *
 * Actually clearing the cached data and closing dialogs doesn't need
 * separate code here: cache purging already happened centrally in
 * lib/queryClient.ts before this event fired, and navigating away from
 * /projects/:id unmounts ProjectDetail's entire subtree -- which is where
 * every project dialog (TodoForm, BugForm, MilestoneForm, ProjectSettings,
 * InviteMemberDialog, RoleFormDialog, TransferOwnershipDialog, etc.) lives
 * -- so they close as a natural consequence of the unmount rather than
 * needing to be tracked and closed one by one. */
export function useProjectAccessListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useNotifications();

  // Keep the latest location/toast in refs so the subscription itself
  // doesn't need to be torn down and re-created on every navigation.
  const locationRef = useRef(location);
  locationRef.current = location;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    return onProjectAccessLost((projectId) => {
      toastRef.current("You no longer have access to this project.", "error");

      const path = locationRef.current.pathname;
      if (path === `/projects/${projectId}` || path.startsWith(`/projects/${projectId}/`)) {
        navigate("/projects", { replace: true });
      }
    });
  }, [navigate]);
}

/** For components that keep their *own* local "selected project" state
 * outside of the /projects/:id route -- e.g. the AI Workspace views
 * (ZipManagerView, ConversationsView, AIHandoffsView, KnowledgeBaseView),
 * which filter/scope their data to a project via a dropdown rather than a
 * URL param. Those don't get unmounted by the navigate-to-/projects above
 * (they're not on that route at all), so they clear their own selection
 * -- and by extension close any open create/upload dialog for that
 * project -- via this. `onLost` should reset local state; it does not
 * need to touch the query cache (already handled centrally) or show a
 * toast (already handled by the app-wide listener above). */
export function useProjectAccessLostEffect(projectId: string | undefined, onLost: () => void) {
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  useEffect(() => {
    if (!projectId) return;
    return onProjectAccessLost((lostId) => {
      if (lostId === projectId) onLostRef.current();
    });
  }, [projectId]);
}
