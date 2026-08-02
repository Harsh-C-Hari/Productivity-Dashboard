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
import { FEATURE_STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/projectMeta";
import { usePhases } from "@/hooks/usePhases";
import type { Feature, FeatureInput, FeatureStatus, Priority } from "@/types";

interface FeatureFormProps {
  projectId: string;
  initial?: Feature;
  onSubmit: (payload: FeatureInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const NO_PHASE = "__none__";

export function FeatureForm({ projectId, initial, onSubmit, onCancel, submitting }: FeatureFormProps) {
  const { data: phases } = usePhases({ projectId });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<FeatureStatus>(initial?.status ?? "backlog");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [phaseId, setPhaseId] = useState(initial?.phase_id ?? NO_PHASE);
  const [effort, setEffort] = useState(initial?.estimated_effort_hours ?? 0);
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      project_id: projectId,
      phase_id: phaseId === NO_PHASE ? null : phaseId,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      estimated_effort_hours: effort,
      progress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feature-title">Feature title</Label>
        <Input
          id="feature-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. User authentication"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feature-desc">Description</Label>
        <Textarea
          id="feature-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this feature do?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as FeatureStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Phase</Label>
        <Select value={phaseId} onValueChange={setPhaseId}>
          <SelectTrigger>
            <SelectValue placeholder="No phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PHASE}>No phase</SelectItem>
            {(phases ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feature-effort">Estimated hours</Label>
          <Input
            id="feature-effort"
            type="number"
            min={0}
            step={0.5}
            value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feature-progress">Progress ({progress}%)</Label>
          <input
            id="feature-progress"
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

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {initial ? "Save changes" : "Add feature"}
        </Button>
      </div>
    </form>
  );
}
