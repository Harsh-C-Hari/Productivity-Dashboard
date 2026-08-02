import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Plus, Search, Pencil, Trash2, ArrowLeft, Archive, ClipboardList, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import {
  useConversations,
  useConversation,
  useConversationSummary,
  useCreateConversation,
  useUpdateConversation,
  useDeleteConversation,
} from "@/hooks/useConversations";
import { useAIAccounts } from "@/hooks/useAIAccounts";
import { useProjects } from "@/hooks/useProjects";
import { useAIHandoffs } from "@/hooks/useAIHandoffs";
import { CONVERSATION_STATUS_META, CONVERSATION_STATUS_OPTIONS } from "@/lib/aiWorkspaceMeta";
import type { Conversation, ConversationInput } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function ConversationsView() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  if (conversationId) {
    return <ConversationDetail id={conversationId} onBack={() => navigate("/ai-workspace/conversations")} />;
  }
  return <ConversationListPanel />;
}

function ConversationListPanel() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: conversations, isLoading } = useConversations({
    q: search.trim() || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as Conversation["status"]),
  });
  const { data: accounts } = useAIAccounts();
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Conversations</h2>
          <p className="text-xs text-muted-foreground">Chats and sessions with your AI accounts.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CONVERSATION_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)} disabled={!accounts?.length}>
            <Plus className="h-3.5 w-3.5" /> Start
          </Button>
        </div>
      </div>

      {!accounts?.length && !isLoading && (
        <div className="glass-card p-4 text-sm text-muted-foreground">
          Add an AI account first — conversations belong to an account.
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse bg-white/[0.02]" />)}</div>
      )}

      {!isLoading && (conversations ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No conversations yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Start a conversation to begin tracking a session with an assistant."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {(conversations ?? []).map((conversation) => {
            const account = accountsById.get(conversation.ai_account_id);
            const statusMeta = CONVERSATION_STATUS_META[conversation.status];
            return (
              <motion.div key={conversation.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card
                  className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => navigate(`/ai-workspace/conversations/${conversation.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-display font-semibold text-sm truncate">{conversation.title}</h3>
                        <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{conversation.summary || "No summary yet"}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {account?.name ?? "Unknown account"}</span>
                        <span>{conversation.message_count} messages</span>
                        <span>started {formatDistanceToNow(new Date(conversation.started_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a conversation</DialogTitle>
            <DialogDescription>Log a new chat/session with one of your AI accounts.</DialogDescription>
          </DialogHeader>
          <ConversationForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConversationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: conversation, isLoading } = useConversation(id);
  const { data: summary } = useConversationSummary(id);
  const { data: accounts } = useAIAccounts();
  const { data: handoffs } = useAIHandoffs({ conversationId: id });
  const deleteConversation = useDeleteConversation();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !conversation) {
    return <div className="glass-card h-64 animate-pulse bg-white/[0.02]" />;
  }

  const account = (accounts ?? []).find((a) => a.id === conversation.ai_account_id);
  const statusMeta = CONVERSATION_STATUS_META[conversation.status];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-3.5 w-3.5" /> All conversations
      </button>

      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="font-display text-lg font-semibold">{conversation.title}</h2>
              <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" /> {account?.name ?? "Unknown account"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit conversation">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-urgency-critical" onClick={() => setConfirmDelete(true)} aria-label="Delete conversation">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-sm leading-relaxed whitespace-pre-wrap">{conversation.summary || "No summary recorded yet."}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          <MetaTile label="Started" value={formatDistanceToNow(new Date(conversation.started_at), { addSuffix: true })} />
          <MetaTile label="Last message" value={conversation.last_message_at ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true }) : "—"} />
          <MetaTile label="Messages" value={String(conversation.message_count)} />
          <MetaTile label="Tokens used" value={(summary?.total_tokens_used ?? 0).toLocaleString()} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold">Handoffs from this conversation</h3>
        </div>
        {(handoffs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No handoff notes yet — created/modified files, remaining work, and known issues get recorded in AI Handoffs.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(handoffs ?? []).map((h) => (
              <div key={h.id} className="rounded-lg border border-white/10 bg-base-900/40 p-3 text-sm">
                <p className="line-clamp-2">{h.completed_work || "Handoff notes"}</p>
                {h.next_objective && <p className="text-xs text-muted-foreground mt-1">Next: {h.next_objective}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="glass-card flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <Archive className="h-3.5 w-3.5 shrink-0" />
        {summary?.zip_count ?? 0} zip snapshot{(summary?.zip_count ?? 0) === 1 ? "" : "s"} linked to this conversation — see ZIP Manager.
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit conversation</DialogTitle>
            <DialogDescription>Update the details for "{conversation.title}".</DialogDescription>
          </DialogHeader>
          <ConversationForm initial={conversation} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{conversation.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteConversation.mutate(conversation.id);
                setConfirmDelete(false);
                onBack();
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-base-900/40 py-2 px-2 text-center">
      <p className="font-mono text-sm font-semibold truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function ConversationForm({ initial, onDone }: { initial?: Conversation; onDone: () => void }) {
  const { data: accounts } = useAIAccounts();
  const { data: projects } = useProjects();
  const createConversation = useCreateConversation();
  const updateConversation = useUpdateConversation();

  const [aiAccountId, setAiAccountId] = useState(initial?.ai_account_id ?? accounts?.[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>(initial?.project_id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");

  const submitting = createConversation.isPending || updateConversation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !aiAccountId) return;
    if (initial) {
      updateConversation.mutate(
        {
          id: initial.id,
          payload: {
            title: title.trim(),
            summary: summary.trim(),
            status: status as ConversationInput["status"],
            project_id: projectId || undefined,
            clear_project: !projectId,
          },
        },
        { onSuccess: onDone }
      );
    } else {
      createConversation.mutate(
        {
          ai_account_id: aiAccountId,
          project_id: projectId || undefined,
          title: title.trim(),
          summary: summary.trim(),
          status: status as ConversationInput["status"],
        },
        { onSuccess: onDone }
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!initial && (
        <div className="flex flex-col gap-1.5">
          <Label>AI account</Label>
          <Select value={aiAccountId} onValueChange={setAiAccountId}>
            <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
            <SelectContent>
              {(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conv-title">Title</Label>
        <Input id="conv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI Workspace frontend build" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Project (optional)</Label>
        <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conv-summary">Summary</Label>
        <Textarea id="conv-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="What's this conversation about?" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONVERSATION_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={submitting || !title.trim() || !aiAccountId}>
          {initial ? "Save changes" : "Start conversation"}
        </Button>
      </div>
    </form>
  );
}
