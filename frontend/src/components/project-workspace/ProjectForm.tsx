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
import { SUBJECT_COLORS, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { PROJECT_STATUS_OPTIONS, PROJECT_ICONS } from "@/lib/projectMeta";
import { ProjectIcon } from "@/components/project-workspace/ProjectIcon";
import { cn } from "@/lib/utils";
import type { Project, ProjectInput, ProjectStatus } from "@/types";

interface ProjectFormProps {
  initial?: Project;
  onSubmit: (payload: ProjectInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function ProjectForm({ initial, onSubmit, onCancel, submitting }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "folder");
  const [color, setColor] = useState(initial?.color ?? "purple");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planning");
  const [repositoryUrl, setRepositoryUrl] = useState(initial?.repository_url ?? "");
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      status,
      repository_url: repositoryUrl.trim(),
      progress,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Personal Productivity System"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-desc">Description</Label>
        <Textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this project about?"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Icon</Label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                icon === i
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/10 bg-base-900/40 text-muted-foreground hover:border-white/20"
              )}
              aria-label={`Icon ${i}`}
            >
              <ProjectIcon icon={i} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Color tag</Label>
        <div className="flex gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-transform",
                color === c ? "border-white scale-110" : "border-transparent"
              )}
              aria-label={`Color ${c}`}
            >
              <span className={cn("h-4 w-4 rounded-full", SUBJECT_COLOR_CLASSES[c].dot)} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-repo">Repository URL</Label>
          <Input
            id="project-repo"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            placeholder="https://github.com/..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-tags">Tags (comma separated)</Label>
        <Input
          id="project-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. web, react, side-project"
        />
      </div>

      {initial && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-progress">Overall progress ({progress}%)</Label>
          <input
            id="project-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-primary h-10"
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {initial ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
