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
import { BUG_SEVERITY_OPTIONS, BUG_STATUS_OPTIONS } from "@/lib/projectMeta";
import { usePhases } from "@/hooks/usePhases";
import { useFeatures } from "@/hooks/useFeatures";
import type { Bug, BugInput, BugSeverity, BugStatus } from "@/types";

const NO_LINK = "__none__";

interface BugFormProps {
  projectId: string;
  initial?: Bug;
  onSubmit: (payload: BugInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function BugForm({ projectId, initial, onSubmit, onCancel, submitting }: BugFormProps) {
  const { data: phases } = usePhases({ projectId });
  const { data: features } = useFeatures({ projectId });

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [severity, setSeverity] = useState<BugSeverity>(initial?.severity ?? "medium");
  const [status, setStatus] = useState<BugStatus>(initial?.status ?? "open");
  const [resolution, setResolution] = useState(initial?.resolution ?? "");
  const [phaseId, setPhaseId] = useState(initial?.phase_id ?? NO_LINK);
  const [featureId, setFeatureId] = useState(initial?.feature_id ?? NO_LINK);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      project_id: projectId,
      phase_id: phaseId === NO_LINK ? null : phaseId,
      feature_id: featureId === NO_LINK ? null : featureId,
      title: title.trim(),
      description: description.trim(),
      severity,
      status,
      resolution: resolution.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-title">Bug title</Label>
        <Input
          id="bug-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Login form doesn't validate email"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-desc">Description</Label>
        <Textarea
          id="bug-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps to reproduce, expected vs actual behavior"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as BugSeverity)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUG_SEVERITY_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as BugStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUG_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      {(status === "resolved" || status === "wont_fix" || status === "duplicate") && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-resolution">Resolution notes</Label>
          <Textarea
            id="bug-resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="What fixed it, or why it was closed"
            rows={2}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {initial ? "Save changes" : "Report bug"}
        </Button>
      </div>
    </form>
  );
}
