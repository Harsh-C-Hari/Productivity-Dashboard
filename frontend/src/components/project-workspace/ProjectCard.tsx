import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, Trash2, ListChecks, Bug as BugIcon, Milestone as MilestoneIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProjectForm } from "@/components/project-workspace/ProjectForm";
import { ProjectIcon } from "@/components/project-workspace/ProjectIcon";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { useDeleteProject, useUpdateProject } from "@/hooks/useProjects";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { PROJECT_STATUS_META } from "@/lib/projectMeta";
import type { Project, ProjectInput, ProjectSummary } from "@/types";

interface ProjectCardProps {
  project: Project;
  summary?: ProjectSummary;
}

export function ProjectCard({ project, summary }: ProjectCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const colorClasses = SUBJECT_COLOR_CLASSES[project.color] ?? SUBJECT_COLOR_CLASSES.purple;
  const statusMeta = PROJECT_STATUS_META[project.status];
  const rate = summary?.overall_progress ?? project.progress;

  function handleEditSubmit(payload: ProjectInput) {
    updateProject.mutate({ id: project.id, payload }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
        <Card className="group relative overflow-hidden p-5">
          <div className={`absolute inset-x-0 top-0 h-1 ${colorClasses.dot}`} />

          <div className="flex items-start justify-between gap-3">
            <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <ProjectIcon icon={project.icon} className={`h-4 w-4 shrink-0 ${colorClasses.text}`} />
                <h3 className="font-display font-semibold text-sm truncate">{project.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.2em]">
                {project.description || "No description yet"}
              </p>
            </Link>

            <ProgressRing progress={rate} size={48} strokeWidth={4} color={subjectColorHex(project.color)}>
              <span className="font-mono text-[10px] font-semibold">{Math.round(rate)}%</span>
            </ProgressRing>
          </div>

          <div className="mt-3">
            <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className="font-mono text-sm font-semibold">
                {summary ? `${summary.completed_todo_count}/${summary.todo_count}` : "–"}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <ListChecks className="h-3 w-3" /> todos
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className={`font-mono text-sm font-semibold ${(summary?.open_bug_count ?? 0) > 0 ? "text-urgency-critical" : ""}`}>
                {summary?.open_bug_count ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <BugIcon className="h-3 w-3" /> open bugs
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className="font-mono text-sm font-semibold">
                {summary ? `${summary.completed_milestone_count}/${summary.milestone_count}` : "–"}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <MilestoneIcon className="h-3 w-3" /> milestones
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Link to={`/projects/${project.id}`} className="text-xs font-medium text-primary hover:underline underline-offset-2">
              Open project →
            </Link>
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit project">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the details for this project.</DialogDescription>
          </DialogHeader>
          <ProjectForm
            initial={project}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateProject.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{project.name}"?</DialogTitle>
            <DialogDescription>
              This also deletes every phase, feature, todo, bug, milestone, resource, and document in this project, and can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteProject.mutate(project.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
