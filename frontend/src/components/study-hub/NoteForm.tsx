import { useState } from "react";
import { Eye, Pencil as PencilIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AttachmentList } from "@/components/study-hub/AttachmentList";
import { useSubjects, useTopics } from "@/hooks/useSubjects";
import { useUploadNoteAttachment, useDeleteNoteAttachment } from "@/hooks/useNotes";
import { renderMarkdownLite } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { Note, NoteInput } from "@/types";

interface NoteFormProps {
  initial?: Note;
  defaultSubjectId?: string;
  onSubmit: (payload: NoteInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function NoteForm({ initial, defaultSubjectId, onSubmit, onCancel, submitting }: NoteFormProps) {
  const { data: subjects } = useSubjects();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subject_id ?? defaultSubjectId ?? "");
  const [topicId, setTopicId] = useState(initial?.topic_id ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");

  const { data: topics } = useTopics(subjectId || undefined);
  const uploadAttachment = useUploadNoteAttachment();
  const deleteAttachment = useDeleteNoteAttachment();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;
    onSubmit({ title: title.trim(), content, subject_id: subjectId, topic_id: topicId || null });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-title">Title</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. DP recurrence cheat sheet"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Subject</Label>
          <Select
            value={subjectId}
            onValueChange={(v) => {
              setSubjectId(v);
              setTopicId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {(subjects ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Topic (optional)</Label>
          <Select value={topicId || "__none"} onValueChange={(v) => setTopicId(v === "__none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="No topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No topic</SelectItem>
              {(topics ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="note-content">Content</Label>
          <div className="flex gap-1 rounded-lg bg-base-800/70 border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                tab === "write" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <PencilIcon className="h-3 w-3" /> Write
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                tab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <Eye className="h-3 w-3" /> Preview
            </button>
          </div>
        </div>

        {tab === "write" ? (
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"Write in markdown-lite: **bold**, *italic*, `code`, # headers, - lists"}
            rows={10}
            className="font-mono text-[13px]"
          />
        ) : (
          <div
            className="min-h-[220px] rounded-xl border border-white/10 bg-base-900/40 px-3.5 py-2.5 text-sm scrollbar-thin overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdownLite(content) || "<p class='text-muted-foreground'>Nothing to preview yet.</p>" }}
          />
        )}
      </div>

      {initial && (
        <div className="flex flex-col gap-1.5">
          <Label>Attachments</Label>
          <AttachmentList
            attachments={initial.attachments}
            uploading={uploadAttachment.isPending}
            onUpload={(file) => uploadAttachment.mutate({ id: initial.id, file })}
            onDelete={(filename) => deleteAttachment.mutate({ id: initial.id, filename })}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim() || !subjectId}>
          {initial ? "Save changes" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
