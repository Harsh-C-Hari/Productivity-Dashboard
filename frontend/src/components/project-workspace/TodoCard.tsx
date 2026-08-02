import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Trash2, Clock } from "lucide-react";
import { UrgencyRing } from "@/components/tasks/UrgencyRing";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { TodoForm } from "@/components/project-workspace/TodoForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDeleteProjectTodo, useUpdateProjectTodo } from "@/hooks/useProjectTodos";
import { formatDeadline, formatCountdown, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ProjectTodo, ProjectTodoInput } from "@/types";

interface TodoCardProps {
  todo: ProjectTodo;
  compact?: boolean;
}

export function TodoCard({ todo, compact = false }: TodoCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateTodo = useUpdateProjectTodo();
  const deleteTodo = useDeleteProjectTodo();

  const overdue = isOverdue(todo.deadline) && todo.status !== "done";

  function toggleComplete() {
    updateTodo.mutate({
      id: todo.id,
      payload: { status: todo.status === "done" ? "todo" : "done" },
    });
  }

  function handleEditSubmit(payload: ProjectTodoInput) {
    updateTodo.mutate(
      {
        id: todo.id,
        payload: {
          ...payload,
          clear_deadline: !payload.deadline,
          clear_phase: !payload.phase_id,
          clear_feature: !payload.feature_id,
        },
      },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={cn("glass-card group flex items-center gap-3 p-3.5", todo.status === "done" && "opacity-60")}
      >
        <UrgencyRing progress={todo.progress} urgency={todo.urgency} size={compact ? 44 : 52} strokeWidth={4}>
          <button
            onClick={toggleComplete}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
              todo.status === "done"
                ? "bg-urgency-low border-urgency-low text-base-950"
                : "border-white/20 text-transparent hover:border-primary hover:text-primary/60"
            )}
            aria-label={todo.status === "done" ? "Mark as not done" : "Mark as done"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </UrgencyRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-medium text-sm truncate", todo.status === "done" && "line-through")}>
              {todo.title}
            </p>
            {!compact && todo.status !== "done" && <UrgencyBadge urgency={todo.urgency} />}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            {todo.feature_title && <span className="font-medium">{todo.feature_title}</span>}
            {todo.phase_title && (
              <>
                {todo.feature_title && <span className="opacity-40">·</span>}
                <span>{todo.phase_title}</span>
              </>
            )}
            {todo.deadline && (
              <>
                <span className="opacity-40">·</span>
                <span className={cn("flex items-center gap-1", overdue && "text-urgency-critical")}>
                  <Clock className="h-3 w-3" />
                  {formatDeadline(todo.deadline)}
                  {!compact && ` (${formatCountdown(todo.deadline)})`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit todo">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete todo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit todo</DialogTitle>
            <DialogDescription>Update the details, and urgency recalculates automatically.</DialogDescription>
          </DialogHeader>
          <TodoForm
            projectId={todo.project_id}
            mode="edit"
            initial={todo}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateTodo.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{todo.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteTodo.mutate(todo.id);
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
