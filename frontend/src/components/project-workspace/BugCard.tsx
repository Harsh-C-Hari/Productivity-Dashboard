import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Bug as BugIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { BugForm } from "@/components/project-workspace/BugForm";
import { useUpdateBug, useDeleteBug } from "@/hooks/useBugs";
import { BUG_SEVERITY_META, BUG_STATUS_META } from "@/lib/projectMeta";
import { formatDeadline } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Bug, BugInput } from "@/types";

interface BugCardProps {
  bug: Bug;
  showProjectHint?: boolean;
}

export function BugCard({ bug }: BugCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateBug = useUpdateBug();
  const deleteBug = useDeleteBug();

  const severityMeta = BUG_SEVERITY_META[bug.severity];
  const statusMeta = BUG_STATUS_META[bug.status];
  const closed = bug.status === "resolved" || bug.status === "wont_fix" || bug.status === "duplicate";

  function handleEditSubmit(payload: BugInput) {
    updateBug.mutate({ id: bug.id, payload }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className={cn("group p-4", closed && "opacity-70")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <BugIcon className="h-3.5 w-3.5 text-urgency-critical shrink-0" />
                <h4 className={cn("font-medium text-sm truncate", closed && "line-through")}>{bug.title}</h4>
              </div>
              {bug.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{bug.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge label={severityMeta.label} colorClass={severityMeta.color} textClass={severityMeta.text} dotClass={severityMeta.dot} />
                <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
                {bug.feature_title && (
                  <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full border border-white/10">
                    {bug.feature_title}
                  </span>
                )}
              </div>
              {closed && bug.resolved_at && (
                <p className="text-[11px] text-muted-foreground mt-2">Closed {formatDeadline(bug.resolved_at)}</p>
              )}
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
          </div>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bug</DialogTitle>
            <DialogDescription>Update this bug's details.</DialogDescription>
          </DialogHeader>
          <BugForm
            projectId={bug.project_id}
            initial={bug}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateBug.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{bug.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteBug.mutate(bug.id);
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
