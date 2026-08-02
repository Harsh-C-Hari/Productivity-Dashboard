import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useTasks } from "@/hooks/useTasks";
import { CATEGORY_META } from "@/lib/urgency";
import type { Task, TaskCategory, TaskStatus } from "@/types";

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

type StatusFilter = "active" | TaskStatus | "all";

export function TaskList() {
  const { data: tasks, isLoading } = useTasks();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");

  const filtered = useMemo(() => {
    if (!tasks) return [];
    let list = tasks;

    if (statusFilter === "active") list = list.filter((t) => t.status !== "done");
    else if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);

    if (categoryFilter !== "all") list = list.filter((t) => t.category === categoryFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
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
  }, [tasks, statusFilter, categoryFilter, search]);

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
              placeholder="Search tasks..."
              className="pl-8"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TaskCategory | "all")}>
            <SelectTrigger className="w-[140px]">
              <ListFilter className="h-3.5 w-3.5 mr-1 opacity-60" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <TaskListSkeleton />}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-display text-lg font-semibold">Nothing here</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search || categoryFilter !== "all"
              ? "Try adjusting your filters or search."
              : "Use the + button to capture your first task."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((task: Task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card h-[72px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
