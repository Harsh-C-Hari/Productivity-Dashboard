import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useUpdateProject } from "@/hooks/useProjects";
import { VISIBILITY_META, VISIBILITY_OPTIONS, PROJECT_TYPE_OPTIONS } from "@/lib/collaborationMeta";
import type { Project, ProjectVisibility, ProjectType } from "@/types";

interface ProjectSettingsGeneralProps {
  project: Project;
  canManage: boolean;
}

export function ProjectSettingsGeneral({ project, canManage }: ProjectSettingsGeneralProps) {
  const updateProject = useUpdateProject();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [projectType, setProjectType] = useState<ProjectType>(project.project_type);
  const [collaborationEnabled, setCollaborationEnabled] = useState(project.collaboration_enabled);

  const dirty =
    name !== project.name ||
    description !== project.description ||
    visibility !== project.visibility ||
    projectType !== project.project_type ||
    collaborationEnabled !== project.collaboration_enabled;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    updateProject.mutate({
      id: project.id,
      payload: {
        name: name.trim(),
        description: description.trim(),
        visibility,
        project_type: projectType,
        collaboration_enabled: collaborationEnabled,
      },
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-name">Project name</Label>
          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-desc">Description</Label>
          <Textarea
            id="settings-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={!canManage}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as ProjectVisibility)} disabled={!canManage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{VISIBILITY_META[visibility].description}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Project type</Label>
            <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)} disabled={!canManage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Collaboration enabled</p>
          <p className="text-xs text-muted-foreground">
            Turn off to hide invites and role assignment for this project. Existing members keep access.
          </p>
        </div>
        <Switch checked={collaborationEnabled} onCheckedChange={setCollaborationEnabled} disabled={!canManage} />
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || updateProject.isPending}>
            {updateProject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}
