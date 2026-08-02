import { useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useNavigate } from "react-router-dom";
import type { Project } from "@/types";

interface ProjectSettingsDangerZoneProps {
  project: Project;
  isOwner: boolean;
}

export function ProjectSettingsDangerZone({ project, isOwner }: ProjectSettingsDangerZoneProps) {
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!isOwner) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <AlertTriangle className="h-6 w-6" />
        Only the project Owner can access the Danger Zone.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-urgency-medium/30">
        <div>
          <p className="text-sm font-medium">{project.archived ? "Unarchive project" : "Archive project"}</p>
          <p className="text-xs text-muted-foreground">
            {project.archived
              ? "Restore this project to your active list."
              : "Hide this project from your active list without deleting anything."}
          </p>
        </div>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => updateProject.mutate({ id: project.id, payload: { archived: !project.archived } })}
          disabled={updateProject.isPending}
        >
          {updateProject.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : project.archived ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          {project.archived ? "Unarchive" : "Archive"}
        </Button>
      </Card>

      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-urgency-critical/30">
        <div>
          <p className="text-sm font-medium text-urgency-critical">Delete project</p>
          <p className="text-xs text-muted-foreground">
            Permanently deletes this project, all members, invitations, phases, features, bugs, and resources. This
            can't be undone.
          </p>
        </div>
        <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and everything in it. Type the project name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-project-name" className="sr-only">
              Project name
            </Label>
            <Input
              id="confirm-project-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={project.name}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmText !== project.name || deleteProject.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteProject.mutate(project.id, { onSuccess: () => navigate("/projects") });
              }}
            >
              {deleteProject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
