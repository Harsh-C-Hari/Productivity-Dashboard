import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NoteCard } from "@/components/study-hub/NoteCard";
import { NoteForm } from "@/components/study-hub/NoteForm";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import type { NoteInput } from "@/types";

interface NoteListProps {
  subjectId?: string;
  topicId?: string;
}

export function NoteList({ subjectId, topicId }: NoteListProps) {
  const [search, setSearch] = useState("");
  const { data: notes, isLoading } = useNotes({ subjectId, topicId, q: search || undefined });
  const createNote = useCreateNote();
  const [addOpen, setAddOpen] = useState(false);

  function handleCreate(payload: NoteInput) {
    createNote.mutate(payload, { onSuccess: () => setAddOpen(false) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-8"
          />
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add note
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!isLoading && (notes ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-display text-lg font-semibold">No notes yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Capture what you learn as you study."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {(notes ?? []).map((note) => (
            <NoteCard key={note.id} note={note} hideSubject={!!subjectId} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
            <DialogDescription>Markdown-lite formatting supported.</DialogDescription>
          </DialogHeader>
          <NoteForm
            defaultSubjectId={subjectId}
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            submitting={createNote.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
