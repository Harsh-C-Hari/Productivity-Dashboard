import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, FileUp, Download, Trash2, RefreshCw, Star, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProjects } from "@/hooks/useProjects";
import { useAIAccounts } from "@/hooks/useAIAccounts";
import { useConversations } from "@/hooks/useConversations";
import {
  useProjectZips,
  useUploadProjectZip,
  useReplaceProjectZip,
  useDeleteProjectZip,
} from "@/hooks/useProjectZips";
import { useProjectAccessLostEffect } from "@/hooks/useProjectAccessGuard";
import type { ProjectZip } from "@/types";
import { formatDistanceToNow } from "date-fns";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function ZipManagerView() {
  const { data: projects } = useProjects();
  const { data: accounts } = useAIAccounts();
  const [projectId, setProjectId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<ProjectZip | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectZip | null>(null);

  // If the project this view is currently filtered to becomes
  // inaccessible (member removed), drop the filter back to "all
  // projects" and close any zip dialog that was scoped to it -- the
  // cache purge and toast are already handled centrally.
  useProjectAccessLostEffect(projectId || undefined, () => {
    setProjectId("");
    setUploadOpen(false);
    setReplaceTarget(null);
    setConfirmDelete(null);
  });

  const { data: zips, isLoading } = useProjectZips(projectId ? { projectId } : undefined);
  const replaceZip = useReplaceProjectZip();
  const deleteZip = useDeleteProjectZip();
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  const sorted = useMemo(
    () => [...(zips ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [zips]
  );
  const currentByProject = useMemo(() => {
    const map = new Map<string, string>();
    for (const zip of sorted) {
      if (!map.has(zip.project_id)) map.set(zip.project_id, zip.id);
    }
    return map;
  }, [sorted]);

  function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && replaceTarget) {
      replaceZip.mutate({ id: replaceTarget.id, file });
    }
    setReplaceTarget(null);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">ZIP Manager</h2>
          <p className="text-xs text-muted-foreground">Project snapshots handed off between AI sessions.</p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44 shrink-0"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setUploadOpen(true)} disabled={!projects?.length}>
            <FileUp className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </div>

      <input ref={replaceInputRef} type="file" accept=".zip" className="hidden" onChange={handleReplaceFile} />

      {isLoading && (
        <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse bg-white/[0.02]" />)}</div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Archive className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No zips uploaded yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Upload a project snapshot so the next AI session can pick up right where the last one left off.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {sorted.map((zip) => {
            const isCurrent = currentByProject.get(zip.project_id) === zip.id;
            const project = (projects ?? []).find((p) => p.id === zip.project_id);
            const account = zip.ai_account_id ? accountsById.get(zip.ai_account_id) : undefined;
            return (
              <motion.div key={zip.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10">
                        <Archive className="h-4.5 w-4.5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-display font-semibold text-sm truncate">{zip.original_name || zip.file_name || "Untitled zip"}</h3>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <Star className="h-2.5 w-2.5 fill-primary" /> Current
                            </span>
                          )}
                          {zip.version_label && (
                            <span className="text-[10px] font-mono rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">{zip.version_label}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {!projectId && project ? `${project.name} · ` : ""}
                          {formatBytes(zip.file_size_bytes)} · {formatDistanceToNow(new Date(zip.created_at), { addSuffix: true })}
                        </p>
                        {zip.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{zip.notes}</p>}
                        {account && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Bot className="h-3 w-3" /> {account.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {zip.file_path && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Download zip">
                          <a href={zip.file_path} download><Download className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReplaceTarget(zip); replaceInputRef.current?.click(); }} aria-label="Replace zip">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-urgency-critical" onClick={() => setConfirmDelete(zip)} aria-label="Delete zip">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload project zip</DialogTitle>
            <DialogDescription>Hand off a snapshot of the codebase to the next AI session.</DialogDescription>
          </DialogHeader>
          <ZipUploadForm defaultProjectId={projectId} onDone={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this zip?</DialogTitle>
            <DialogDescription>{confirmDelete?.original_name || "This zip"} will be permanently removed.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) deleteZip.mutate(confirmDelete.id);
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

function ZipUploadForm({ defaultProjectId, onDone }: { defaultProjectId?: string; onDone: () => void }) {
  const { data: projects } = useProjects();
  const { data: accounts } = useAIAccounts();
  const uploadZip = useUploadProjectZip();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || projects?.[0]?.id || "");
  const { data: conversations } = useConversations({ projectId: selectedProjectId || undefined });
  const [aiAccountId, setAiAccountId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string>("");
  const [versionLabel, setVersionLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Selecting a project the user no longer has access to would otherwise
  // keep refetching its conversations (403 -> cache cleared -> refetch ->
  // 403 -> ...), firing an endless stream of toasts. Deselect it instead
  // -- same behavior as the "filter by project" dropdown above.
  useProjectAccessLostEffect(selectedProjectId || undefined, () => setSelectedProjectId(""));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedProjectId) return;
    uploadZip.mutate(
      {
        projectId: selectedProjectId,
        aiAccountId: aiAccountId || undefined,
        conversationId: conversationId || undefined,
        versionLabel: versionLabel.trim(),
        notes: notes.trim(),
        file,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Project</Label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger>
          <SelectContent>
            {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 hover:border-primary/50 bg-base-900/40 py-8 transition-colors"
      >
        <FileUp className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{file ? file.name : "ZIP file — click to choose"}</span>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>AI account (optional)</Label>
          <Select value={aiAccountId || "none"} onValueChange={(v) => setAiAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Conversation (optional)</Label>
          <Select value={conversationId || "none"} onValueChange={(v) => setConversationId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(conversations ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zip-version">Version label</Label>
        <Input id="zip-version" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="e.g. v12, post-auth-refactor" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zip-notes">Notes</Label>
        <Textarea id="zip-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What changed in this snapshot?" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={uploadZip.isPending || !file || !selectedProjectId}>Upload</Button>
      </div>
    </form>
  );
}
