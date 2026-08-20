import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Plus, Search, Pencil, Trash2, Star, Clock, MessageSquare, Archive, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { TokenRefreshCountdown } from "./TokenRefreshCountdown";
import {
  useAIAccountSummaries,
  useCreateAIAccount,
  useUpdateAIAccount,
  useDeleteAIAccount,
  useTouchAIAccount,
} from "@/hooks/useAIAccounts";
import { AI_PROVIDER_META, AI_ACCOUNT_STATUS_META, AI_PROVIDER_OPTIONS, AI_ACCOUNT_STATUS_OPTIONS, getDefaultAccountId, setDefaultAccountId } from "@/lib/aiWorkspaceMeta";
import type { AIAccount, AIAccountInput, AIAccountSummary } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function AIAccountsView() {
  const { data: summaries, isLoading } = useAIAccountSummaries();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [defaultId, setDefaultIdState] = useState<string | null>(null);

  useEffect(() => {
    setDefaultIdState(getDefaultAccountId());
  }, []);

  const filtered = useMemo(() => {
    let list = summaries ?? [];
    if (statusFilter !== "all") list = list.filter((s) => s.account.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.account.name.toLowerCase().includes(q) || s.account.description.toLowerCase().includes(q)
      );
    }
    // Soonest-refreshing account first (accounts with no reminder set
    // fall back to the old "most recently updated" order, after every
    // account that does have one) -- the default-starred account, if
    // any, still always stays pinned at the very top regardless.
    // Reminder now comes straight off the account (synced via the
    // backend, see TokenRefreshCountdown/models.py), so summaries
    // refetching after a save is what keeps this in sync -- no
    // separate local "reminders changed" event needed anymore.
    return [...list].sort((a, b) => {
      if (a.account.id === defaultId) return -1;
      if (b.account.id === defaultId) return 1;
      const aReminder = a.account.token_refresh_reminder_at;
      const bReminder = b.account.token_refresh_reminder_at;
      if (aReminder && bReminder) return new Date(aReminder).getTime() - new Date(bReminder).getTime();
      if (aReminder) return -1;
      if (bReminder) return 1;
      return new Date(b.account.updated_at).getTime() - new Date(a.account.updated_at).getTime();
    });
  }, [summaries, search, statusFilter, defaultId]);
  function handleSetDefault(id: string) {
    const next = defaultId === id ? null : id;
    setDefaultAccountId(next);
    setDefaultIdState(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">AI Accounts</h2>
          <p className="text-xs text-muted-foreground">Every assistant you work with — Claude, GPT, Gemini, or otherwise.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {AI_ACCOUNT_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse bg-white/[0.02]" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No AI accounts yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? "Try a different search." : "Add the assistants you work with to start tracking conversations and usage."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {filtered.map((summary) => (
            <AIAccountCard
              key={summary.account.id}
              summary={summary}
              isDefault={summary.account.id === defaultId}
              onSetDefault={() => handleSetDefault(summary.account.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add AI account</DialogTitle>
            <DialogDescription>Configure a new assistant you work with.</DialogDescription>
          </DialogHeader>
          <AIAccountForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AIAccountCard({
  summary,
  isDefault,
  onSetDefault,
}: {
  summary: AIAccountSummary;
  isDefault: boolean;
  onSetDefault: () => void;
}) {
  const { account } = summary;
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateAccount = useUpdateAIAccount();
  const deleteAccount = useDeleteAIAccount();
  const touchAccount = useTouchAIAccount();
  const providerMeta = AI_PROVIDER_META[account.provider];
  const statusMeta = AI_ACCOUNT_STATUS_META[account.status];

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
        <Card className="group relative overflow-hidden p-4 flex flex-col gap-3">
          {isDefault && <div className="absolute inset-x-0 top-0 h-1 bg-primary" />}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-semibold text-sm truncate">{account.name}</h3>
                  {isDefault && <Star className="h-3 w-3 fill-primary text-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{account.model || providerMeta.label}</p>
              </div>
            </div>
            <button
              onClick={onSetDefault}
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              aria-label={isDefault ? "Unset default account" : "Set as default account"}
              title={isDefault ? "Default account (click to unset)" : "Set as default"}
            >
              <Star className={`h-4 w-4 ${isDefault ? "fill-primary text-primary" : ""}`} />
            </button>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.2em]">
            {account.description || "No description yet"}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge label={providerMeta.label} colorClass={providerMeta.color} textClass={providerMeta.text} dotClass={providerMeta.dot} />
            <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
          </div>

          {account.current_task && (
            <div className="flex items-start gap-1.5 rounded-lg border border-white/10 bg-base-900/40 px-2.5 py-2 text-xs">
              <ClipboardList className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="line-clamp-2 text-muted-foreground">{account.current_task}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-1.5">
              <p className="font-mono text-xs font-semibold flex items-center justify-center gap-1">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                {summary.conversation_count}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">convos</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-1.5">
              <p className="font-mono text-xs font-semibold flex items-center justify-center gap-1">
                <Archive className="h-3 w-3 text-muted-foreground" />
                {summary.zip_count}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">zips</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-base-900/40 py-1.5">
              <p className="font-mono text-xs font-semibold">{summary.total_tokens_used.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">tokens</p>
            </div>
          </div>

          <TokenRefreshCountdown
            accountId={account.id}
            accountName={account.name}
            reminderAt={account.token_refresh_reminder_at}
            isLimited={account.is_token_limited}
          />
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => touchAccount.mutate(account.id)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              title="Mark as just used"
            >
              <Clock className="h-3 w-3" />
              {summary.last_active_at
                ? `active ${formatDistanceToNow(new Date(summary.last_active_at), { addSuffix: true })}`
                : `updated ${formatDistanceToNow(new Date(account.updated_at), { addSuffix: true })}`}
            </button>
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(true)} aria-label="Edit account">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-urgency-critical"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete account"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit AI account</DialogTitle>
            <DialogDescription>Update the details for {account.name}.</DialogDescription>
          </DialogHeader>
          <AIAccountForm
            initial={account}
            onDone={() => setEditOpen(false)}
            onSubmitOverride={(payload) => updateAccount.mutate({ id: account.id, payload }, { onSuccess: () => setEditOpen(false) })}
            submitting={updateAccount.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{account.name}"?</DialogTitle>
            <DialogDescription>
              This also deletes its conversations and token usage history. Zip snapshots and handoffs stay, but un-link from this account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteAccount.mutate(account.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AIAccountForm({
  initial,
  onDone,
  onSubmitOverride,
  submitting,
}: {
  initial?: AIAccount;
  onDone: () => void;
  onSubmitOverride?: (payload: Partial<AIAccountInput>) => void;
  submitting?: boolean;
}) {
  const createAccount = useCreateAIAccount();
  const [name, setName] = useState(initial?.name ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "claude");
  const [model, setModel] = useState(initial?.model ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState(initial?.api_key_env_var ?? "");
  const [currentTask, setCurrentTask] = useState(initial?.current_task ?? "");

  const isSubmitting = onSubmitOverride ? submitting : createAccount.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: AIAccountInput = {
      name: name.trim(),
      provider: provider as AIAccountInput["provider"],
      model: model.trim(),
      description: description.trim(),
      status: status as AIAccountInput["status"],
      api_key_env_var: apiKeyEnvVar.trim(),
      current_task: currentTask.trim(),
    };
    if (onSubmitOverride) {
      onSubmitOverride(payload);
    } else {
      createAccount.mutate(payload, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude — Backend" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AI_PROVIDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-model">Model</Label>
          <Input id="account-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. claude-sonnet-4-6" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-description">Description</Label>
        <Textarea id="account-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's this account for?" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-current-task">Current task</Label>
        <Textarea id="account-current-task" value={currentTask} onChange={(e) => setCurrentTask(e.target.value)} rows={2} placeholder="What is this assistant working on right now?" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AI_ACCOUNT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-env-var">API key env var</Label>
          <Input id="account-env-var" value={apiKeyEnvVar} onChange={(e) => setApiKeyEnvVar(e.target.value)} placeholder="ANTHROPIC_API_KEY" />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Name of the environment variable holding the real key — never paste the key itself here.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {initial ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
