import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Trash2, Clock, BookOpen } from "lucide-react";
import { UrgencyRing } from "@/components/tasks/UrgencyRing";
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { AssignmentForm } from "@/components/study-hub/AssignmentForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDeleteAssignment, useUpdateAssignment } from "@/hooks/useAssignments";
import { formatDeadline, formatCountdown, isOverdue } from "@/lib/dates";
import { SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { cn } from "@/lib/utils";
import type { Assignment, AssignmentInput } from "@/types";

interface AssignmentCardProps {
  assignment: Assignment;
  compact?: boolean;
  hideSubject?: boolean;
}

export function AssignmentCard({ assignment, compact = false, hideSubject = false }: AssignmentCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();

  const overdue = isOverdue(assignment.deadline) && assignment.status !== "done";
  const colorClasses = SUBJECT_COLOR_CLASSES[assignment.subject_color ?? "purple"] ?? SUBJECT_COLOR_CLASSES.purple;

  function toggleComplete() {
    updateAssignment.mutate({
      id: assignment.id,
      payload: { status: assignment.status === "done" ? "todo" : "done" },
    });
  }

  function handleEditSubmit(payload: AssignmentInput) {
    updateAssignment.mutate(
      { id: assignment.id, payload: { ...payload, clear_deadline: !payload.deadline, clear_topic: !payload.topic_id } },
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
          assignment.status === "done" && "opacity-60"
        )}
      >
        <UrgencyRing progress={assignment.progress} urgency={assignment.urgency} size={compact ? 44 : 52} strokeWidth={4}>
          <button
            onClick={toggleComplete}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
              assignment.status === "done"
                ? "bg-urgency-low border-urgency-low text-base-950"
                : "border-white/20 text-transparent hover:border-primary hover:text-primary/60"
            )}
            aria-label={assignment.status === "done" ? "Mark as not done" : "Mark as done"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </UrgencyRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-medium text-sm truncate", assignment.status === "done" && "line-through")}>
              {assignment.title}
            </p>
            {!compact && assignment.status !== "done" && <UrgencyBadge urgency={assignment.urgency} />}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            {!hideSubject && assignment.subject_name && (
              <>
                <span className={cn("flex items-center gap-1 font-medium", colorClasses.text)}>
                  <BookOpen className="h-3 w-3" /> {assignment.subject_name}
                </span>
                {assignment.deadline && <span className="opacity-40">·</span>}
              </>
            )}
            {assignment.deadline && (
              <span className={cn("flex items-center gap-1", overdue && "text-urgency-critical")}>
                <Clock className="h-3 w-3" />
                {formatDeadline(assignment.deadline)}
                {!compact && ` (${formatCountdown(assignment.deadline)})`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit assignment">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete assignment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit assignment</DialogTitle>
            <DialogDescription>Update the details, and urgency recalculates automatically.</DialogDescription>
          </DialogHeader>
          <AssignmentForm
            mode="edit"
            initial={assignment}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateAssignment.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{assignment.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteAssignment.mutate(assignment.id);
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
