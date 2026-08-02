import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus } from "lucide-react";
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
import { AssignmentCard } from "@/components/study-hub/AssignmentCard";
import { AssignmentForm } from "@/components/study-hub/AssignmentForm";
import { useAssignments, useCreateAssignment } from "@/hooks/useAssignments";
import type { Assignment, AssignmentInput, AssignmentStatus } from "@/types";

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
type StatusFilter = "active" | AssignmentStatus | "all";

interface AssignmentListProps {
  subjectId?: string;
  topicId?: string;
}

export function AssignmentList({ subjectId, topicId }: AssignmentListProps) {
  const { data: assignments, isLoading } = useAssignments({ subjectId, topicId });
  const createAssignment = useCreateAssignment();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!assignments) return [];
    let list = assignments;

    if (statusFilter === "active") list = list.filter((a) => a.status !== "done");
    else if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [assignments, statusFilter, search]);

  function handleCreate(payload: AssignmentInput) {
    createAssignment.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="todo">To do</TabsTrigger>
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
              placeholder="Search assignments..."
              className="pl-8"
            />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {isLoading && <AssignmentListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-display text-lg font-semibold">Nothing here</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Add your first assignment to get started."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((assignment: Assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} hideSubject={!!subjectId} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add assignment</DialogTitle>
            <DialogDescription>Track it by subject, and urgency is calculated automatically.</DialogDescription>
          </DialogHeader>
          <AssignmentForm
            mode="create"
            defaultSubjectId={subjectId}
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            submitting={createAssignment.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card h-[72px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
