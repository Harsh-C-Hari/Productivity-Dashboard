import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Trash2, Clock, GripVertical } from "lucide-react";
import { UrgencyRing } from "@/components/tasks/UrgencyRing";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDeleteTask, useUpdateTask } from "@/hooks/useTasks";
import { formatDeadline, formatCountdown, isOverdue } from "@/lib/dates";
import { CATEGORY_META } from "@/lib/urgency";
import { cn } from "@/lib/utils";
import type { Task, TaskInput } from "@/types";

interface TaskCardProps {
  task: Task;
  compact?: boolean;
}

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const overdue = isOverdue(task.deadline) && task.status !== "done";
  const category = CATEGORY_META[task.category];

  function toggleComplete() {
    updateTask.mutate({
      id: task.id,
      payload: { status: task.status === "done" ? "todo" : "done" },
    });
  }

  function handleEditSubmit(payload: TaskInput) {
    updateTask.mutate(
      { id: task.id, payload: { ...payload, clear_deadline: !payload.deadline } },
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
        className={cn(
          "glass-card group flex items-center gap-3 p-3.5",
          task.status === "done" && "opacity-60"
        )}
      >
        <UrgencyRing progress={task.progress} urgency={task.urgency} size={compact ? 44 : 52} strokeWidth={4}>
          <button
            onClick={toggleComplete}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
              task.status === "done"
                ? "bg-urgency-low border-urgency-low text-base-950"
                : "border-white/20 text-transparent hover:border-primary hover:text-primary/60"
            )}
            aria-label={task.status === "done" ? "Mark as not done" : "Mark as done"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </UrgencyRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-medium text-sm truncate", task.status === "done" && "line-through")}>
              {task.title}
            </p>
            {!compact && task.status !== "done" && <UrgencyBadge urgency={task.urgency} />}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className={cn("font-medium", category.color)}>{category.label}</span>
            {task.deadline && (
              <>
                <span className="opacity-40">·</span>
                <span className={cn("flex items-center gap-1", overdue && "text-urgency-critical")}>
                  <Clock className="h-3 w-3" />
                  {formatDeadline(task.deadline)}
                  {!compact && ` (${formatCountdown(task.deadline)})`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit task">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!compact && <GripVertical className="hidden md:block h-4 w-4 text-white/10 group-hover:text-white/20" />}
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update the details, and urgency recalculates automatically.</DialogDescription>
          </DialogHeader>
          <TaskForm
            mode="edit"
            initial={task}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateTask.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{task.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteTask.mutate(task.id);
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
