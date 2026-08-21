import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubjectForm } from "@/components/study-hub/SubjectForm";
import { SubjectCard } from "@/components/study-hub/SubjectCard";
import { StudyHubSearch } from "@/components/study-hub/StudyHubSearch";
import { StudyTimer } from "@/components/study-hub/StudyTimer";
import { StudyAnalytics } from "@/components/study-hub/StudyAnalytics";
import { StudySessionList } from "@/components/study-hub/StudySessionList";
import { useSubjects, useCreateSubject } from "@/hooks/useSubjects";
import { useStudyHubSummary } from "@/hooks/useStudyHub";
import type { SubjectInput } from "@/types";

export default function StudyHub() {
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { data: summary, isLoading: summaryLoading } = useStudyHubSummary();
  const createSubject = useCreateSubject();
  const [addOpen, setAddOpen] = useState(false);

  const progressBySubject = new Map((summary?.subjects_progress ?? []).map((sp) => [sp.subject.id, sp]));

  function handleCreate(payload: SubjectInput) {
    createSubject.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <StudyHubSearch />
        <Button className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add subject
        </Button>
      </div>

      {subjectsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card h-52 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!subjectsLoading && (subjects ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <p className="font-display text-lg font-semibold">No subjects yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add your first class to start tracking assignments, notes, and resources.
          </p>
          <Button className="gap-1.5 mt-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add subject
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence initial={false}>
          {(subjects ?? []).map((subject) => (
            <SubjectCard key={subject.id} subject={subject} progress={progressBySubject.get(subject.id)} />
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StudyTimer />
        <div className="lg:col-span-2">
          {summaryLoading && <div className="glass-card h-72 animate-pulse bg-white/[0.02]" />}
          {!summaryLoading && summary && <StudyAnalytics analytics={summary.analytics} />}
        </div>
      </div>

      <StudySessionList />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add subject</DialogTitle>
            <DialogDescription>Create a class to organize assignments, notes, and resources.</DialogDescription>
          </DialogHeader>
          <SubjectForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} submitting={createSubject.isPending} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
