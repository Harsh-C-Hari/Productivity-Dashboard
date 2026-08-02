import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, FileUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateProjectResourceLink, useUploadProjectResourceFile } from "@/hooks/useProjectResources";

interface ProjectResourceFormProps {
  projectId: string;
  onDone: () => void;
}

export function ProjectResourceForm({ projectId, onDone }: ProjectResourceFormProps) {
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useUploadProjectResourceFile();
  const createLink = useCreateProjectResourceLink();
  const submitting = uploadFile.isPending || createLink.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (mode === "upload") {
      if (!file) return;
      uploadFile.mutate({ projectId, title: title.trim(), file }, { onSuccess: onDone });
    } else {
      if (!url.trim()) return;
      createLink.mutate({ project_id: projectId, title: title.trim(), external_url: url.trim() }, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "link")}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload file
          </TabsTrigger>
          <TabsTrigger value="link" className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> Add link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 hover:border-primary/50 bg-base-900/40 py-8 transition-colors"
          >
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {file ? file.name : "PDF, PPT, DOCX, image, or ZIP — click to choose"}
            </span>
          </button>
        </TabsContent>

        <TabsContent value="link" className="mt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-resource-url">External URL</Label>
            <Input
              id="project-resource-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-resource-title">Title</Label>
        <Input
          id="project-resource-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. API design doc, Figma mockups"
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim() || (mode === "upload" ? !file : !url.trim())}>
          {mode === "upload" ? "Upload" : "Add link"}
        </Button>
      </div>
    </form>
  );
}
