import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, Trash2, BookOpen, Clock, ListChecks, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SubjectForm } from "@/components/study-hub/SubjectForm";
import { useDeleteSubject, useUpdateSubject } from "@/hooks/useSubjects";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import type { Subject, SubjectInput, SubjectProgress } from "@/types";

interface SubjectCardProps {
  subject: Subject;
  progress?: SubjectProgress;
}

export function SubjectCard({ subject, progress }: SubjectCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const colorClasses = SUBJECT_COLOR_CLASSES[subject.color] ?? SUBJECT_COLOR_CLASSES.purple;
  const rate = progress?.completion_rate ?? 0;

  function handleEditSubmit(payload: SubjectInput) {
    updateSubject.mutate({ id: subject.id, payload }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
        <Card className="group relative overflow-hidden p-5">
          <div className={`absolute inset-x-0 top-0 h-1 ${colorClasses.dot}`} />

          <div className="flex items-start justify-between gap-3">
            <Link to={`/study-hub/${subject.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <BookOpen className={`h-4 w-4 shrink-0 ${colorClasses.text}`} />
                <h3 className="font-display font-semibold text-sm truncate">{subject.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {[subject.code, subject.instructor].filter(Boolean).join(" · ") || "No details yet"}
              </p>
            </Link>

            <ProgressRing progress={rate} size={48} strokeWidth={4} color={subjectColorHex(subject.color)}>
              <span className="font-mono text-[10px] font-semibold">{rate}%</span>
            </ProgressRing>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className="font-mono text-sm font-semibold">{progress?.total_assignments ?? 0}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <ListChecks className="h-3 w-3" /> tasks
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className={`font-mono text-sm font-semibold ${(progress?.overdue_assignments ?? 0) > 0 ? "text-urgency-critical" : ""}`}>
                {progress?.overdue_assignments ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <AlertTriangle className="h-3 w-3" /> overdue
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
              <p className="font-mono text-sm font-semibold">{progress?.hours_studied_this_week ?? 0}h</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" /> this wk
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Link
              to={`/study-hub/${subject.id}`}
              className="text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              Open subject →
            </Link>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(true)} aria-label="Edit subject">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-urgency-critical"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete subject"
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
            <DialogTitle>Edit subject</DialogTitle>
            <DialogDescription>Update the details for this class.</DialogDescription>
          </DialogHeader>
          <SubjectForm
            initial={subject}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateSubject.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{subject.name}"?</DialogTitle>
            <DialogDescription>
              This also deletes every assignment, note, and resource in this subject, and can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteSubject.mutate(subject.id);
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
