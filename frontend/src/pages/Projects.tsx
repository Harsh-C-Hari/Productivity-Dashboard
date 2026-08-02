import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProjectForm } from "@/components/project-workspace/ProjectForm";
import { ProjectCard } from "@/components/project-workspace/ProjectCard";
import { ProjectSearch } from "@/components/project-workspace/ProjectSearch";
import { useProjects, useCreateProject, useWorkspaceSummary } from "@/hooks/useProjects";
import type { ProjectInput } from "@/types";

export default function Projects() {
  const { data: projects, isLoading: projectsLoading } = useProjects({ archived: false });
  const { data: summary } = useWorkspaceSummary();
  const createProject = useCreateProject();
  const [addOpen, setAddOpen] = useState(false);

  const summaryByProject = new Map((summary?.projects_progress ?? []).map((ps) => [ps.project.id, ps]));

  function handleCreate(payload: ProjectInput) {
    createProject.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <ProjectSearch />
        <Button className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </div>

      {projectsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card h-52 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!projectsLoading && (projects ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <FolderKanban className="h-7 w-7 text-primary" />
          </div>
          <p className="font-display text-lg font-semibold">No projects yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create your first project to start tracking phases, features, todos, and bugs.
          </p>
          <Button className="gap-1.5 mt-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence initial={false}>
          {(projects ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} summary={summaryByProject.get(project.id)} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Set up a project to organize phases, features, todos, and bugs.</DialogDescription>
          </DialogHeader>
          <ProjectForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} submitting={createProject.isPending} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
