import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, NotebookPen, Paperclip } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NoteForm } from "@/components/study-hub/NoteForm";
import { useDeleteNote, useUpdateNote } from "@/hooks/useNotes";
import { renderMarkdownLite } from "@/lib/markdown";
import { SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import type { Note, NoteInput } from "@/types";

export function NoteCard({ note, hideSubject = false }: { note: Note; hideSubject?: boolean }) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const colorClasses = SUBJECT_COLOR_CLASSES[note.subject_color ?? "purple"] ?? SUBJECT_COLOR_CLASSES.purple;
  const plainSnippet = note.content.replace(/[#*`_>-]/g, "").slice(0, 140);

  function handleEditSubmit(payload: NoteInput) {
    updateNote.mutate(
      { id: note.id, payload: { ...payload, clear_topic: !payload.topic_id } },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
        <Card
          className="group cursor-pointer p-4 flex flex-col gap-2 h-full"
          onClick={() => setViewOpen(true)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <NotebookPen className={`h-3.5 w-3.5 shrink-0 ${colorClasses.text}`} />
              <h4 className="font-medium text-sm truncate">{note.title}</h4>
            </div>
            {note.attachments.length > 0 && (
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{plainSnippet || "Empty note"}</p>

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {!hideSubject && note.subject_name && <span className={colorClasses.text}>{note.subject_name}</span>}
              <span className="opacity-50">{formatDistanceToNowStrict(new Date(note.updated_at), { addSuffix: true })}</span>
            </div>
            <div
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditOpen(true)} aria-label="Edit note">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-urgency-critical"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete note"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{note.title}</DialogTitle>
            <DialogDescription>
              {note.subject_name} · updated {formatDistanceToNowStrict(new Date(note.updated_at), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div
            className="text-sm scrollbar-thin overflow-y-auto max-h-[50vh]"
            dangerouslySetInnerHTML={{ __html: renderMarkdownLite(note.content) }}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setViewOpen(false);
                setEditOpen(true);
              }}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
            <DialogDescription>Markdown-lite formatting supported.</DialogDescription>
          </DialogHeader>
          <NoteForm
            initial={note}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateNote.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{note.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteNote.mutate(note.id);
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
