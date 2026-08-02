import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProjectResourceCard } from "@/components/project-workspace/ProjectResourceCard";
import { ProjectResourceForm } from "@/components/project-workspace/ProjectResourceForm";
import { useProjectResources } from "@/hooks/useProjectResources";
import type { ProjectResource } from "@/types";

export function ProjectResourceList({ projectId }: { projectId: string }) {
  const { data: resources, isLoading } = useProjectResources({ projectId });
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!resources) return [];
    if (!search.trim()) return resources;
    const q = search.toLowerCase();
    return resources.filter((r) => r.title.toLowerCase().includes(q));
  }, [resources, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Resources</h3>
          <p className="text-xs text-muted-foreground">Design files, docs, and links for this project.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="pl-8"
            />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {isLoading && <ProjectResourceListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No resources yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Upload files or link out to designs, docs, or references."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((resource: ProjectResource) => (
            <ProjectResourceCard key={resource.id} resource={resource} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add resource</DialogTitle>
            <DialogDescription>Upload a file or link out to something external.</DialogDescription>
          </DialogHeader>
          <ProjectResourceForm projectId={projectId} onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectResourceListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card h-[76px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
