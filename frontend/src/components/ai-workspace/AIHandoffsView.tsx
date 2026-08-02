import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, Plus, Search, Pencil, Trash2, Bot, FolderKanban, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { renderMarkdownLite } from "@/lib/markdown";
import { useAIHandoffs, useCreateAIHandoff, useUpdateAIHandoff, useDeleteAIHandoff } from "@/hooks/useAIHandoffs";
import { useProjects } from "@/hooks/useProjects";
import { useAIAccounts } from "@/hooks/useAIAccounts";
import { useConversations } from "@/hooks/useConversations";
import type { AIHandoff, AIHandoffInput } from "@/types";
import { formatDistanceToNow } from "date-fns";

function fileListToText(files: string[]): string {
  return files.join("\n");
}
function textToFileList(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function AIHandoffsView() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const { data: projects } = useProjects();
  const { data: accounts } = useAIAccounts();
  const { data: handoffs, isLoading } = useAIHandoffs({
    q: search.trim() || undefined,
    projectId: projectFilter === "all" ? undefined : projectFilter,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [viewHandoff, setViewHandoff] = useState<AIHandoff | null>(null);
  const [editHandoff, setEditHandoff] = useState<AIHandoff | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AIHandoff | null>(null);
  const deleteHandoff = useDeleteAIHandoff();

  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  const sorted = useMemo(
    () => [...(handoffs ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [handoffs]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">AI Handoffs</h2>
          <p className="text-xs text-muted-foreground">What got done, what's left, and what's next — for the next session.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search handoffs..." className="pl-8" />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New handoff
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <div key={i} className="glass-card h-24 animate-pulse bg-white/[0.02]" />)}</div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No handoffs yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Write a handoff at the end of a session so the next one starts without rediscovering the project.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {sorted.map((handoff) => {
            const project = handoff.project_id ? projectsById.get(handoff.project_id) : undefined;
            const account = handoff.ai_account_id ? accountsById.get(handoff.ai_account_id) : undefined;
            return (
              <motion.div key={handoff.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setViewHandoff(handoff)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-clamp-2">{handoff.completed_work || "Handoff notes"}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                        {project && <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" /> {project.name}</span>}
                        {account && <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {account.name}</span>}
                        <span>{handoff.created_files.length} created · {handoff.modified_files.length} modified</span>
                        <span>{formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}</span>
                      </div>
                      {handoff.next_objective && (
                        <p className="text-xs text-primary/90 mt-1.5 flex items-center gap-1 line-clamp-1">
                          <ArrowRight className="h-3 w-3 shrink-0" /> {handoff.next_objective}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditHandoff(handoff)} aria-label="Edit handoff"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-urgency-critical" onClick={() => setConfirmDelete(handoff)} aria-label="Delete handoff"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New handoff</DialogTitle>
            <DialogDescription>Record what was completed and what the next session needs to know.</DialogDescription>
          </DialogHeader>
          <AIHandoffForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editHandoff} onOpenChange={(open) => !open && setEditHandoff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit handoff</DialogTitle>
          </DialogHeader>
          {editHandoff && <AIHandoffForm initial={editHandoff} onDone={() => setEditHandoff(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewHandoff} onOpenChange={(open) => !open && setViewHandoff(null)}>
        <DialogContent className="max-w-2xl">
          {viewHandoff && (
            <>
              <DialogHeader>
                <DialogTitle>Handoff · {formatDistanceToNow(new Date(viewHandoff.created_at), { addSuffix: true })}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-4">
                <HandoffSection title="Completed work" content={viewHandoff.completed_work} />
                <div className="grid grid-cols-2 gap-3">
                  <FileListSection title="Created files" files={viewHandoff.created_files} />
                  <FileListSection title="Modified files" files={viewHandoff.modified_files} />
                </div>
                <HandoffSection title="Remaining work" content={viewHandoff.remaining_work} />
                <HandoffSection title="Architecture decisions & known issues" content={viewHandoff.known_issues} />
                <HandoffSection title="Next objective" content={viewHandoff.next_objective} highlight />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setViewHandoff(null)}>Close</Button>
                <Button className="gap-1.5" onClick={() => { setEditHandoff(viewHandoff); setViewHandoff(null); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this handoff?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmDelete) deleteHandoff.mutate(confirmDelete.id); setConfirmDelete(null); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HandoffSection({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  if (!content) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      <div
        className={`rounded-lg border p-3 text-sm leading-relaxed prose-invert max-w-none [&_code]:text-primary ${
          highlight ? "border-primary/30 bg-primary/5" : "border-white/10 bg-base-900/40"
        }`}
        dangerouslySetInnerHTML={{ __html: renderMarkdownLite(content) }}
      />
    </div>
  );
}

function FileListSection({ title, files }: { title: string; files: string[] }) {
  if (!files.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{title} ({files.length})</p>
      <div className="rounded-lg border border-white/10 bg-base-900/40 p-3 max-h-32 overflow-y-auto">
        {files.map((f) => <p key={f} className="font-mono text-xs text-muted-foreground truncate">{f}</p>)}
      </div>
    </div>
  );
}

function AIHandoffForm({ initial, onDone }: { initial?: AIHandoff; onDone: () => void }) {
  const { data: projects } = useProjects();
  const { data: accounts } = useAIAccounts();
  const createHandoff = useCreateAIHandoff();
  const updateHandoff = useUpdateAIHandoff();

  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [aiAccountId, setAiAccountId] = useState(initial?.ai_account_id ?? "");
  const { data: conversations } = useConversations({ projectId: projectId || undefined });
  const [conversationId, setConversationId] = useState(initial?.conversation_id ?? "");
  const [completedWork, setCompletedWork] = useState(initial?.completed_work ?? "");
  const [createdFiles, setCreatedFiles] = useState(fileListToText(initial?.created_files ?? []));
  const [modifiedFiles, setModifiedFiles] = useState(fileListToText(initial?.modified_files ?? []));
  const [remainingWork, setRemainingWork] = useState(initial?.remaining_work ?? "");
  const [knownIssues, setKnownIssues] = useState(initial?.known_issues ?? "");
  const [nextObjective, setNextObjective] = useState(initial?.next_objective ?? "");

  const submitting = createHandoff.isPending || updateHandoff.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AIHandoffInput = {
      project_id: projectId || undefined,
      ai_account_id: aiAccountId || undefined,
      conversation_id: conversationId || undefined,
      completed_work: completedWork.trim(),
      created_files: textToFileList(createdFiles),
      modified_files: textToFileList(modifiedFiles),
      remaining_work: remainingWork.trim(),
      known_issues: knownIssues.trim(),
      next_objective: nextObjective.trim(),
    };
    if (initial) {
      updateHandoff.mutate({ id: initial.id, payload }, { onSuccess: onDone });
    } else {
      createHandoff.mutate(payload, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Project</Label>
          <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>AI account</Label>
          <Select value={aiAccountId || "none"} onValueChange={(v) => setAiAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Conversation</Label>
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
        <Label htmlFor="handoff-completed">Completed work</Label>
        <Textarea id="handoff-completed" value={completedWork} onChange={(e) => setCompletedWork(e.target.value)} rows={3} placeholder="Summary of what was accomplished (Markdown supported)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handoff-created-files">Created files (one per line)</Label>
          <Textarea id="handoff-created-files" value={createdFiles} onChange={(e) => setCreatedFiles(e.target.value)} rows={4} className="font-mono text-xs" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handoff-modified-files">Modified files (one per line)</Label>
          <Textarea id="handoff-modified-files" value={modifiedFiles} onChange={(e) => setModifiedFiles(e.target.value)} rows={4} className="font-mono text-xs" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="handoff-remaining">Remaining work</Label>
        <Textarea id="handoff-remaining" value={remainingWork} onChange={(e) => setRemainingWork(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="handoff-issues">Architecture decisions & known issues</Label>
        <Textarea id="handoff-issues" value={knownIssues} onChange={(e) => setKnownIssues(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="handoff-next">Next objective</Label>
        <Textarea id="handoff-next" value={nextObjective} onChange={(e) => setNextObjective(e.target.value)} rows={2} placeholder="Exact next step for the next session" />
      </div>

      <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-base-950/80 backdrop-blur -mx-1 px-1 py-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{initial ? "Save changes" : "Save handoff"}</Button>
      </div>
    </form>
  );
}
