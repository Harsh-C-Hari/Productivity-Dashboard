import { useState } from "react";
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
import { UrgencyBadge } from "@/components/tasks/UrgencyBadge";
import { AttachmentList } from "@/components/study-hub/AttachmentList";
import { computeUrgency } from "@/lib/urgency";
import { useSubjects, useTopics } from "@/hooks/useSubjects";
import {
  useUploadAssignmentAttachment,
  useDeleteAssignmentAttachment,
} from "@/hooks/useAssignments";
import type { Assignment, AssignmentInput, AssignmentStatus } from "@/types";

const STATUSES: { value: AssignmentStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AssignmentFormProps {
  mode: "create" | "edit";
  initial?: Assignment;
  defaultSubjectId?: string;
  onSubmit: (payload: AssignmentInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function AssignmentForm({
  mode,
  initial,
  defaultSubjectId,
  onSubmit,
  onCancel,
  submitting,
}: AssignmentFormProps) {
  const { data: subjects } = useSubjects();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subject_id ?? defaultSubjectId ?? "");
  const [topicId, setTopicId] = useState<string>(initial?.topic_id ?? "");
  const [deadline, setDeadline] = useState(toLocalInputValue(initial?.deadline ?? null));
  const [effort, setEffort] = useState(initial?.estimated_effort_hours ?? 1);
  const [status, setStatus] = useState<AssignmentStatus>(initial?.status ?? "todo");
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  const { data: topics } = useTopics(subjectId || undefined);
  const uploadAttachment = useUploadAssignmentAttachment();
  const deleteAttachment = useDeleteAssignmentAttachment();

  const isoDeadline = deadline ? new Date(deadline).toISOString() : null;
  const previewUrgency = computeUrgency(isoDeadline, effort, progress, status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      subject_id: subjectId,
      topic_id: topicId || null,
      deadline: isoDeadline,
      estimated_effort_hours: effort,
      status,
      progress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assignment-title">Title</Label>
        <Input
          id="assignment-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Problem Set 4: Dynamic Programming"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assignment-desc">Description</Label>
        <Textarea
          id="assignment-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details worth remembering later"
          rows={3}
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignment-effort">Estimated effort (hrs)</Label>
          <Input
            id="assignment-effort"
            type="number"
            min={0}
            step={0.5}
            value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignment-deadline">Deadline</Label>
          <Input
            id="assignment-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      {mode === "edit" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AssignmentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-progress">Progress ({progress}%)</Label>
            <input
              id="assignment-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary h-10"
            />
          </div>
        </div>
      )}

      {mode === "edit" && initial && (
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

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-base-900/40 px-3.5 py-2.5">
        <span className="text-xs text-muted-foreground">Calculated urgency</span>
        <UrgencyBadge urgency={previewUrgency} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim() || !subjectId}>
          {mode === "create" ? "Create assignment" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
