import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus, Layers } from "lucide-react";
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
import { FeatureCard } from "@/components/project-workspace/FeatureCard";
import { FeatureForm } from "@/components/project-workspace/FeatureForm";
import { useFeatures, useCreateFeature } from "@/hooks/useFeatures";
import type { Feature, FeatureInput, FeatureStatus } from "@/types";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
type StatusFilter = "active" | FeatureStatus | "all";

export function FeatureList({ projectId }: { projectId: string }) {
  const { data: features, isLoading } = useFeatures({ projectId });
  const createFeature = useCreateFeature();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!features) return [];
    let list = features;

    if (statusFilter === "active") list = list.filter((f) => f.status !== "done");
    else if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }, [features, statusFilter, search]);

  function handleCreate(payload: FeatureInput) {
    createFeature.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="backlog">Backlog</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features..."
              className="pl-8"
            />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {isLoading && <FeatureListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Layers className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No features here</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Break the project down into features to track."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((feature: Feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add feature</DialogTitle>
            <DialogDescription>Track a feature and its build progress.</DialogDescription>
          </DialogHeader>
          <FeatureForm
            projectId={projectId}
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            submitting={createFeature.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card h-[104px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
