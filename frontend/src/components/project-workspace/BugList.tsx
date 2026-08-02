import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus, Bug as BugIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BugCard } from "@/components/project-workspace/BugCard";
import { BugForm } from "@/components/project-workspace/BugForm";
import { useBugs, useCreateBug } from "@/hooks/useBugs";
import type { Bug, BugInput, BugStatus } from "@/types";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
type StatusFilter = "open" | BugStatus | "all";

export function BugList({ projectId }: { projectId: string }) {
  const { data: bugs, isLoading } = useBugs({ projectId });
  const createBug = useCreateBug();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!bugs) return [];
    let list = bugs;

    if (statusFilter === "open") list = list.filter((b) => b.status === "open" || b.status === "in_progress");
    else if (statusFilter !== "all") list = list.filter((b) => b.status === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [bugs, statusFilter, search]);

  function handleCreate(payload: BugInput) {
    createBug.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bugs..."
              className="pl-8"
            />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Report
          </Button>
        </div>
      </div>

      {isLoading && <BugListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <BugIcon className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No bugs here</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Nice — nothing open right now."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((bug: Bug) => (
            <BugCard key={bug.id} bug={bug} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report bug</DialogTitle>
            <DialogDescription>Log a bug against this project.</DialogDescription>
          </DialogHeader>
          <BugForm projectId={projectId} onSubmit={handleCreate} onCancel={() => setAddOpen(false)} submitting={createBug.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BugListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card h-[104px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
