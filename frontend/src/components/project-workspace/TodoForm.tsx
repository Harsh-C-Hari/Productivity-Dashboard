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
import { computeUrgency } from "@/lib/urgency";
import { usePhases } from "@/hooks/usePhases";
import { useFeatures } from "@/hooks/useFeatures";
import type { ProjectTodo, ProjectTodoInput, TaskStatus } from "@/types";

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const NO_LINK = "__none__";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TodoFormProps {
  projectId: string;
  mode: "create" | "edit";
  initial?: ProjectTodo;
  onSubmit: (payload: ProjectTodoInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function TodoForm({ projectId, mode, initial, onSubmit, onCancel, submitting }: TodoFormProps) {
  const { data: phases } = usePhases({ projectId });
  const { data: features } = useFeatures({ projectId });

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(toLocalInputValue(initial?.deadline ?? null));
  const [effort, setEffort] = useState(initial?.estimated_effort_hours ?? 1);
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [phaseId, setPhaseId] = useState(initial?.phase_id ?? NO_LINK);
  const [featureId, setFeatureId] = useState(initial?.feature_id ?? NO_LINK);

  const isoDeadline = deadline ? new Date(deadline).toISOString() : null;
  const previewUrgency = computeUrgency(isoDeadline, effort, progress, status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      project_id: projectId,
      phase_id: phaseId === NO_LINK ? null : phaseId,
      feature_id: featureId === NO_LINK ? null : featureId,
      title: title.trim(),
      description: description.trim(),
      deadline: isoDeadline,
      estimated_effort_hours: effort,
      status,
      progress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="todo-title">Title</Label>
        <Input
          id="todo-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Wire up auth middleware"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="todo-desc">Description</Label>
        <Textarea
          id="todo-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details worth remembering later"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Phase</Label>
          <Select value={phaseId} onValueChange={setPhaseId}>
            <SelectTrigger>
              <SelectValue placeholder="No phase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>No phase</SelectItem>
              {(phases ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Feature</Label>
          <Select value={featureId} onValueChange={setFeatureId}>
            <SelectTrigger>
              <SelectValue placeholder="No feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>No feature</SelectItem>
              {(features ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="todo-effort">Estimated effort (hrs)</Label>
          <Input
            id="todo-effort"
            type="number"
            min={0}
            step={0.5}
            value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="todo-deadline">Deadline</Label>
          <Input
            id="todo-deadline"
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
            <Label htmlFor="todo-progress">Progress ({progress}%)</Label>
            <input
              id="todo-progress"
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

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-base-900/40 px-3.5 py-2.5">
        <span className="text-xs text-muted-foreground">Calculated urgency</span>
        <UrgencyBadge urgency={previewUrgency} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {mode === "create" ? "Add todo" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
