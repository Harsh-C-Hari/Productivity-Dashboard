import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, FileUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useSubjects, useTopics } from "@/hooks/useSubjects";
import { useCreateResourceLink, useUploadResourceFile } from "@/hooks/useResources";

interface ResourceFormProps {
  defaultSubjectId?: string;
  onDone: () => void;
}

export function ResourceForm({ defaultSubjectId, onDone }: ResourceFormProps) {
  const { data: subjects } = useSubjects();
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: topics } = useTopics(subjectId || undefined);
  const uploadFile = useUploadResourceFile();
  const createLink = useCreateResourceLink();
  const submitting = uploadFile.isPending || createLink.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !title.trim()) return;

    if (mode === "upload") {
      if (!file) return;
      uploadFile.mutate(
        { subjectId, title: title.trim(), topicId: topicId || null, file },
        { onSuccess: onDone }
      );
    } else {
      if (!url.trim()) return;
      createLink.mutate(
        { subject_id: subjectId, title: title.trim(), topic_id: topicId || null, external_url: url.trim() },
        { onSuccess: onDone }
      );
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
            <Label htmlFor="resource-url">External URL</Label>
            <Input
              id="resource-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resource-title">Title</Label>
        <Input
          id="resource-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lecture slides - Week 4"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !title.trim() || !subjectId || (mode === "upload" ? !file : !url.trim())}
        >
          {mode === "upload" ? "Upload" : "Add link"}
        </Button>
      </div>
    </form>
  );
}
