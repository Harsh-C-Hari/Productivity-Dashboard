import { useMemo, useState } from "react";
import { Plus, FileText, Trash2, Pencil, Eye, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useProjectDocuments,
  useCreateProjectDocument,
  useUpdateProjectDocument,
  useDeleteProjectDocument,
} from "@/hooks/useProjectDocuments";
import { renderMarkdownLite } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { ProjectDocument, ProjectDocumentInput } from "@/types";

export function DocumentList({ projectId }: { projectId: string }) {
  const { data: documents, isLoading } = useProjectDocuments({ projectId });
  const createDoc = useCreateProjectDocument();
  const updateDoc = useUpdateProjectDocument();
  const deleteDoc = useDeleteProjectDocument();

  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProjectDocument | null>(null);

  const sorted = useMemo(() => {
    const list = documents ?? [];
    const filtered = search.trim()
      ? list.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
      : list;
    return [...filtered].sort((a, b) => a.order_index - b.order_index);
  }, [documents, search]);

  const active = sorted.find((d) => d.id === activeId) ?? sorted[0] ?? null;

  function handleCreate() {
    createDoc.mutate(
      { project_id: projectId, title: "Untitled document", content: "", order_index: sorted.length },
      {
        onSuccess: (doc) => {
          setActiveId(doc.id);
          setEditing(true);
        },
      }
    );
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading documentation…</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="lg:w-64 shrink-0 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search docs..." className="pl-8" />
          </div>
          <Button size="icon" className="shrink-0" onClick={handleCreate} aria-label="New document">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {sorted.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No docs yet</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setActiveId(doc.id);
                  setEditing(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors truncate",
                  active?.id === doc.id ? "bg-primary/15 text-primary" : "hover:bg-white/5 text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="flex-1 min-h-[360px] p-5">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Create your first project document</p>
          </div>
        ) : editing ? (
          <DocEditor
            doc={active}
            onSave={(payload) => updateDoc.mutate({ id: active.id, payload }, { onSuccess: () => setEditing(false) })}
            onCancel={() => setEditing(false)}
            submitting={updateDoc.isPending}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-display text-lg font-semibold">{active.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit document">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
                  onClick={() => setConfirmDelete(active)}
                  aria-label="Delete document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {active.content ? (
              <div
                className="prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-display [&_h2]:text-base [&_h2]:font-display [&_code]:text-primary [&_a]:text-secondary"
                dangerouslySetInnerHTML={{ __html: renderMarkdownLite(active.content) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">Empty document — click edit to start writing.</p>
            )}
          </div>
        )}
      </Card>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{confirmDelete?.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  deleteDoc.mutate(confirmDelete.id);
                  if (confirmDelete.id === activeId) setActiveId(null);
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocEditor({
  doc,
  onSave,
  onCancel,
  submitting,
}: {
  doc: ProjectDocument;
  onSave: (payload: Partial<ProjectDocumentInput>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Content (Markdown)</Label>
        <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> {preview ? "Edit" : "Preview"}
        </Button>
      </div>

      {preview ? (
        <div
          className="min-h-[220px] rounded-xl border border-white/10 bg-base-900/40 p-4 text-sm prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdownLite(content) || "<p class='text-muted-foreground italic'>Nothing to preview</p>" }}
        />
      ) : (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write in Markdown..."
          rows={12}
          className="font-mono text-xs"
        />
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={submitting || !title.trim()}
          onClick={() => onSave({ title: title.trim(), content })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
