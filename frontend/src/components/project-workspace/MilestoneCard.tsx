import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Trash2, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MilestoneForm } from "@/components/project-workspace/MilestoneForm";
import { useUpdateMilestone, useDeleteMilestone } from "@/hooks/useMilestones";
import { formatDeadline, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Milestone, MilestoneInput } from "@/types";

export function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const overdue = !milestone.completed && isOverdue(milestone.target_date);

  function toggleComplete() {
    updateMilestone.mutate({
      id: milestone.id,
      payload: { complete_now: !milestone.completed, completed: !milestone.completed },
    });
  }

  function handleEditSubmit(payload: MilestoneInput) {
    updateMilestone.mutate(
      { id: milestone.id, payload: { ...payload, clear_target_date: !payload.target_date, clear_phase: !payload.phase_id } },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className={cn("group flex items-start gap-3 p-4", milestone.completed && "opacity-60")}>
          <button
            onClick={toggleComplete}
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
              milestone.completed
                ? "bg-urgency-low border-urgency-low text-base-950"
                : "border-white/20 text-transparent hover:border-primary hover:text-primary/60"
            )}
            aria-label={milestone.completed ? "Mark as not reached" : "Mark as reached"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Flag className="h-3.5 w-3.5 text-secondary shrink-0" />
              <h4 className={cn("font-medium text-sm truncate", milestone.completed && "line-through")}>
                {milestone.title}
              </h4>
            </div>
            {milestone.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{milestone.description}</p>}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {milestone.target_date && (
                <span className={cn(overdue && "text-urgency-critical font-medium")}>
                  Target {formatDeadline(milestone.target_date)}
                </span>
              )}
              {milestone.phase_title && (
                <>
                  {milestone.target_date && <span className="opacity-40">·</span>}
                  <span>{milestone.phase_title}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit milestone</DialogTitle>
            <DialogDescription>Update this milestone's details.</DialogDescription>
          </DialogHeader>
          <MilestoneForm
            projectId={milestone.project_id}
            initial={milestone}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateMilestone.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{milestone.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMilestone.mutate(milestone.id);
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
