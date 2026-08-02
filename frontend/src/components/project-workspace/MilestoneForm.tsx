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
import { usePhases } from "@/hooks/usePhases";
import type { Milestone, MilestoneInput } from "@/types";

const NO_PHASE = "__none__";

interface MilestoneFormProps {
  projectId: string;
  initial?: Milestone;
  onSubmit: (payload: MilestoneInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function MilestoneForm({ projectId, initial, onSubmit, onCancel, submitting }: MilestoneFormProps) {
  const { data: phases } = usePhases({ projectId });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetDate, setTargetDate] = useState(initial?.target_date?.slice(0, 10) ?? "");
  const [phaseId, setPhaseId] = useState(initial?.phase_id ?? NO_PHASE);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      project_id: projectId,
      phase_id: phaseId === NO_PHASE ? null : phaseId,
      title: title.trim(),
      description: description.trim(),
      target_date: targetDate ? new Date(targetDate).toISOString() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone-title">Milestone title</Label>
        <Input
          id="milestone-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Public beta launch"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone-desc">Description</Label>
        <Textarea
          id="milestone-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does hitting this milestone mean?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="milestone-date">Target date</Label>
          <Input id="milestone-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
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
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {initial ? "Save changes" : "Add milestone"}
        </Button>
      </div>
    </form>
  );
}
