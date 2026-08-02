import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Milestone as MilestoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MilestoneCard } from "@/components/project-workspace/MilestoneCard";
import { MilestoneForm } from "@/components/project-workspace/MilestoneForm";
import { useMilestones, useCreateMilestone } from "@/hooks/useMilestones";
import type { Milestone, MilestoneInput } from "@/types";

type Filter = "upcoming" | "completed" | "all";

export function MilestoneList({ projectId }: { projectId: string }) {
  const { data: milestones, isLoading } = useMilestones({ projectId });
  const createMilestone = useCreateMilestone();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!milestones) return [];
    let list = milestones;
    if (filter === "upcoming") list = list.filter((m) => !m.completed);
    else if (filter === "completed") list = list.filter((m) => m.completed);

    return [...list].sort((a, b) => {
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    });
  }, [milestones, filter]);

  function handleCreate(payload: MilestoneInput) {
    createMilestone.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Reached</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" className="gap-1.5 shrink-0 self-start sm:self-auto" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </Button>
      </div>

      {isLoading && <MilestoneListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <MilestoneIcon className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No milestones here</p>
          <p className="text-sm text-muted-foreground max-w-xs">Mark the big checkpoints for this project.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((m: Milestone) => (
            <MilestoneCard key={m.id} milestone={m} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add milestone</DialogTitle>
            <DialogDescription>Mark a key checkpoint for this project.</DialogDescription>
          </DialogHeader>
          <MilestoneForm projectId={projectId} onSubmit={handleCreate} onCancel={() => setAddOpen(false)} submitting={createMilestone.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MilestoneListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card h-[84px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
