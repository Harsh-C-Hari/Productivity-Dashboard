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
import { PHASE_STATUS_OPTIONS } from "@/lib/projectMeta";
import type { ProjectPhase, ProjectPhaseInput, PhaseStatus } from "@/types";

interface PhaseFormProps {
  projectId: string;
  initial?: ProjectPhase;
  onSubmit: (payload: ProjectPhaseInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function PhaseForm({ projectId, initial, onSubmit, onCancel, submitting }: PhaseFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<PhaseStatus>(initial?.status ?? "pending");
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      project_id: projectId,
      title: title.trim(),
      description: description.trim(),
      status,
      progress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phase-title">Phase title</Label>
        <Input
          id="phase-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Phase 1: Foundation"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phase-desc">Description</Label>
        <Textarea
          id="phase-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this phase cover?"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PhaseStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHASE_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phase-progress">Progress ({progress}%)</Label>
        <input
          id="phase-progress"
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="w-full accent-primary h-10"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {initial ? "Save changes" : "Add phase"}
        </Button>
      </div>
    </form>
  );
}
