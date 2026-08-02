import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus, ListChecks, List, LayoutGrid } from "lucide-react";
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
import { TodoCard } from "@/components/project-workspace/TodoCard";
import { TodoBoard } from "@/components/project-workspace/TodoBoard";
import { TodoForm } from "@/components/project-workspace/TodoForm";
import { useProjectTodos, useCreateProjectTodo } from "@/hooks/useProjectTodos";
import { cn } from "@/lib/utils";
import type { ProjectTodo, ProjectTodoInput, TaskStatus } from "@/types";

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
type StatusFilter = "active" | TaskStatus | "all";
type ViewMode = "list" | "board";

export function TodoList({ projectId }: { projectId: string }) {
  const { data: todos, isLoading } = useProjectTodos({ projectId });
  const createTodo = useCreateProjectTodo();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [view, setView] = useState<ViewMode>("list");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!todos) return [];
    let list = todos;

    if (statusFilter === "active") list = list.filter((t) => t.status !== "done");
    else if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
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
  }, [todos, statusFilter, search]);

  const searchFiltered = useMemo(() => {
    if (!todos) return [];
    if (!search.trim()) return todos;
    const q = search.toLowerCase();
    return todos.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [todos, search]);

  function handleCreate(payload: ProjectTodoInput) {
    createTodo.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="todo">To do</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search todos..."
              className="pl-8"
            />
          </div>
          <div
            role="group"
            aria-label="Todo view"
            className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5 shrink-0"
          >
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                view === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                view === "board" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Board view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {isLoading && <TodoListSkeleton />}

      {view === "board" && !isLoading && (
        searchFiltered.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-display text-lg font-semibold">Nothing here</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search ? "Try a different search." : "Add your first todo to get started."}
            </p>
          </div>
        ) : (
          <TodoBoard todos={searchFiltered} />
        )
      )}

      {view === "list" && !isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ListChecks className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">Nothing here</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Add your first todo to get started."}
          </p>
        </div>
      )}

      {view === "list" && (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {filtered.map((todo: ProjectTodo) => (
              <TodoCard key={todo.id} todo={todo} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add todo</DialogTitle>
            <DialogDescription>Track it by phase or feature, and urgency is calculated automatically.</DialogDescription>
          </DialogHeader>
          <TodoForm
            projectId={projectId}
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            submitting={createTodo.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TodoListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card h-[72px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
