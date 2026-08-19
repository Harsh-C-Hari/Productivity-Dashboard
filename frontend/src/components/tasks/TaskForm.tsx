import { useState, useEffect } from "react";
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
import { computeUrgency, CATEGORY_META } from "@/lib/urgency";
import type { Task, TaskCategory, TaskInput, TaskStatus } from "@/types";

const CATEGORIES: TaskCategory[] = [
  "study",
  "assignment",
  "project",
  "exam",
  "reading",
  "personal",
  "other",
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

/** Converts an ISO datetime string to the value <input type="datetime-local"> expects (local time, no seconds/zone). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TaskFormProps {
  mode: "create" | "edit";
  initial?: Task;
  onSubmit: (payload: TaskInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function TaskForm({ mode, initial, onSubmit, onCancel, submitting }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<TaskCategory>(initial?.category ?? "assignment");
  const [deadline, setDeadline] = useState(toLocalInputValue(initial?.deadline ?? null));
  const [effort, setEffort] = useState(initial?.estimated_effort_hours ?? 1);
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
    const [progress, setProgress] = useState(initial?.progress ?? 0);

  // Forces the urgency preview below to re-evaluate "now" every minute,
  // not just when the user edits a field -- otherwise a form left open
  // for a while (Quick Capture especially) can keep showing a badge
  // that's gone stale relative to the real, ever-approaching deadline.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const isoDeadline = deadline ? new Date(deadline).toISOString() : null;
  const previewUrgency = computeUrgency(isoDeadline, effort, progress, status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      deadline: isoDeadline,
      estimated_effort_hours: effort,
      status,
      progress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Finish problem set 4"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details worth remembering later"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_META[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-effort">Estimated effort (hrs)</Label>
          <Input
            id="task-effort"
            type="number"
            min={0}
            step={0.5}
            value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-deadline">Deadline</Label>
        <Input
          id="task-deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      {mode === "edit" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
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
              <Label htmlFor="task-progress">Progress ({progress}%)</Label>
              <input
                id="task-progress"
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
        </>
      )}

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-base-900/40 px-3.5 py-2.5">
        <span className="text-xs text-muted-foreground">Calculated urgency</span>
        <UrgencyBadge urgency={previewUrgency} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {mode === "create" ? "Create task" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
