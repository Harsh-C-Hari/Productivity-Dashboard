import { useState } from "react";
import { Clock, GripVertical } from "lucide-react";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { useUpdateProjectTodo } from "@/hooks/useProjectTodos";
import { formatDeadline, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ProjectTodo, TaskStatus } from "@/types";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "todo", label: "To do", dot: "bg-white/40" },
  { status: "in_progress", label: "In progress", dot: "bg-primary" },
  { status: "done", label: "Done", dot: "bg-urgency-low" },
];

/** Drag-and-drop Kanban view for Project Todos, grouped by status.
 * This is additive to `TodoList`'s existing filterable-list view (see
 * ARCHITECTURE / AI_HANDOFF Decision 5) rather than a replacement --
 * both read from the same `useProjectTodos` data and the same
 * `useUpdateProjectTodo` mutation, so switching views never loses
 * state. Drag uses native HTML5 DnD (no new dependency); every card
 * also exposes a keyboard-and-screen-reader-friendly status <select>
 * as a first-class equal, not a hidden fallback, since native DnD
 * alone isn't operable without a mouse. */
export function TodoBoard({ todos }: { todos: ProjectTodo[] }) {
  const updateTodo = useUpdateProjectTodo();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  function moveTodo(id: string, status: TaskStatus) {
    const todo = todos.find((t) => t.id === id);
    if (!todo || todo.status === status) return;
    updateTodo.mutate({ id, payload: { status } });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {COLUMNS.map((col) => {
        const items = todos.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatus(col.status);
            }}
            onDragLeave={() => setOverStatus((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/todo-id") || dragId;
              if (id) moveTodo(id, col.status);
              setDragId(null);
              setOverStatus(null);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-2.5 min-h-[10rem] transition-colors",
              overStatus === col.status && "border-primary/40 bg-primary/[0.04]"
            )}
          >
            <div className="flex items-center gap-2 px-1.5 py-1">
              <span className={cn("h-2 w-2 rounded-full", col.dot)} />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h4>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{items.length}</span>
            </div>

            {items.length === 0 && (
              <div className="flex-1 rounded-xl border border-dashed border-white/[0.06] py-6 text-center text-xs text-muted-foreground">
                Drop here
              </div>
            )}

            {items.map((todo) => {
              const overdue = isOverdue(todo.deadline) && todo.status !== "done";
              return (
                <div
                  key={todo.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/todo-id", todo.id);
                    setDragId(todo.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStatus(null);
                  }}
                  className={cn(
                    "glass-card cursor-grab active:cursor-grabbing p-3 text-sm transition-opacity",
                    dragId === todo.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/40 shrink-0" aria-hidden />
                    <p className={cn("min-w-0 flex-1 font-medium truncate", todo.status === "done" && "line-through opacity-70")}>
                      {todo.title}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <UrgencyBadge urgency={todo.urgency} />
                    {todo.deadline && (
                      <span className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", overdue && "text-urgency-critical")}>
                        <Clock className="h-3 w-3" />
                        {formatDeadline(todo.deadline)}
                      </span>
                    )}
                  </div>

                  <label className="sr-only" htmlFor={`move-${todo.id}`}>
                    Move "{todo.title}" to a different status
                  </label>
                  <select
                    id={`move-${todo.id}`}
                    value={todo.status}
                    onChange={(e) => moveTodo(todo.id, e.target.value as TaskStatus)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        Move to: {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
