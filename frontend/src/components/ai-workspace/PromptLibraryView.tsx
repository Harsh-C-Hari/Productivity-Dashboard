import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Plus, Search, Pencil, Trash2, Star, Copy, Files, Clock, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { renderMarkdownLite } from "@/lib/markdown";
import {
  usePromptTemplates,
  usePromptTemplateCategories,
  useRecentPromptTemplates,
  useCreatePromptTemplate,
  useUpdatePromptTemplate,
  useDeletePromptTemplate,
  useDuplicatePromptTemplate,
  useUsePromptTemplate,
} from "@/hooks/usePromptTemplates";
import { FAVORITE_CATEGORY } from "@/lib/aiWorkspaceMeta";
import { useNotifications } from "@/context/NotificationContext";
import type { PromptTemplate, PromptTemplateInput } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function PromptLibraryView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplate | null>(null);
  const [editPrompt, setEditPrompt] = useState<PromptTemplate | null>(null);
  const { toast } = useNotifications();

  const { data: prompts, isLoading } = usePromptTemplates({
    q: search.trim() || undefined,
    category: category === "all" ? undefined : category,
    favoritesOnly: favoritesOnly || undefined,
  });
  const { data: categories } = usePromptTemplateCategories();
  const { data: recent } = useRecentPromptTemplates(5);
  const deletePrompt = useDeletePromptTemplate();
  const duplicatePrompt = useDuplicatePromptTemplate();
  const markUsed = useUsePromptTemplate();
  const updatePrompt = useUpdatePromptTemplate();

  const realCategories = useMemo(
    () => (categories ?? []).filter((c) => c !== FAVORITE_CATEGORY),
    [categories]
  );

  function handleCopy(prompt: PromptTemplate) {
    navigator.clipboard.writeText(prompt.content).then(() => toast("Prompt copied to clipboard", "success"));
    markUsed.mutate(prompt.id);
  }

  function handleToggleFavorite(prompt: PromptTemplate) {
    const nowFavorite = prompt.category !== FAVORITE_CATEGORY;
    updatePrompt.mutate(
      { id: prompt.id, payload: { category: nowFavorite ? FAVORITE_CATEGORY : "" } },
      { onSuccess: () => toast(nowFavorite ? "Added to favorites" : "Removed from favorites", "success") }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Prompt Library</h2>
          <p className="text-xs text-muted-foreground">Reusable prompts, organized by category.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts..." className="pl-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {realCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            <Star className="h-3.5 w-3.5" /> Favorites
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New prompt
          </Button>
        </div>
      </div>

      {!!recent?.length && !search && category === "all" && !favoritesOnly && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Recently used:
          {recent.map((p) => (
            <button key={p.id} onClick={() => setPreviewPrompt(p)} className="rounded-full border border-white/10 px-2.5 py-1 hover:border-primary/40 hover:text-foreground transition-colors">
              {p.title}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-40 animate-pulse bg-white/[0.02]" />)}
        </div>
      )}

      {!isLoading && (prompts ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No prompts yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search || favoritesOnly ? "Try a different filter." : "Save your best prompts here so you never retype them."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {(prompts ?? []).map((prompt) => (
            <motion.div key={prompt.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <Card className="group p-4 flex flex-col gap-2.5 cursor-pointer" onClick={() => setPreviewPrompt(prompt)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold text-sm line-clamp-1">{prompt.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(prompt);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    aria-label={prompt.category === FAVORITE_CATEGORY ? "Remove from favorites" : "Add to favorites"}
                    title={prompt.category === FAVORITE_CATEGORY ? "Favorited (click to remove)" : "Add to favorites"}
                  >
                    <Star className={`h-3.5 w-3.5 ${prompt.category === FAVORITE_CATEGORY ? "fill-primary text-primary" : ""}`} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.2em]">{prompt.description || prompt.content}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {prompt.category && prompt.category !== FAVORITE_CATEGORY && (
                    <StatusBadge label={prompt.category} colorClass="bg-secondary/15 border-secondary/40" textClass="text-secondary" dotClass="bg-secondary" />
                  )}
                  {prompt.variables.map((v) => (
                    <span key={v} className="text-[10px] font-mono rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">{`{{${v}}}`}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>used {prompt.usage_count}×</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(prompt)} aria-label="Copy prompt"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicatePrompt.mutate(prompt.id)} aria-label="Duplicate prompt"><Files className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditPrompt(prompt)} aria-label="Edit prompt"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-urgency-critical" onClick={() => deletePrompt.mutate(prompt.id)} aria-label="Delete prompt"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New prompt</DialogTitle>
            <DialogDescription>Save a reusable prompt template.</DialogDescription>
          </DialogHeader>
          <PromptForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPrompt} onOpenChange={(open) => !open && setEditPrompt(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit prompt</DialogTitle>
            <DialogDescription>Update "{editPrompt?.title}".</DialogDescription>
          </DialogHeader>
          {editPrompt && <PromptForm initial={editPrompt} onDone={() => setEditPrompt(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPrompt} onOpenChange={(open) => !open && setPreviewPrompt(null)}>
        <DialogContent className="max-w-xl">
          {previewPrompt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {previewPrompt.title}
                  {previewPrompt.category === FAVORITE_CATEGORY && <Star className="h-4 w-4 fill-primary text-primary" />}
                </DialogTitle>
                {previewPrompt.description && <DialogDescription>{previewPrompt.description}</DialogDescription>}
              </DialogHeader>
              <div
                className="rounded-xl border border-white/10 bg-base-900/50 p-4 max-h-96 overflow-y-auto prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-display [&_h2]:text-base [&_h2]:font-display [&_code]:text-primary [&_a]:text-secondary"
                dangerouslySetInnerHTML={{ __html: renderMarkdownLite(previewPrompt.content) }}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {previewPrompt.category || "uncategorized"}</span>
                <span>updated {formatDistanceToNow(new Date(previewPrompt.updated_at), { addSuffix: true })}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPreviewPrompt(null)}>Close</Button>
                <Button className="gap-1.5" onClick={() => handleCopy(previewPrompt)}><Copy className="h-3.5 w-3.5" /> Copy prompt</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromptForm({ initial, onDone }: { initial?: PromptTemplate; onDone: () => void }) {
  const createPrompt = useCreatePromptTemplate();
  const updatePrompt = useUpdatePromptTemplate();
  const { data: categories } = usePromptTemplateCategories();
  const realCategories = (categories ?? []).filter((c) => c !== FAVORITE_CATEGORY);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial ? (initial.category === FAVORITE_CATEGORY ? "" : initial.category) : "");
  const [favorite, setFavorite] = useState(initial?.category === FAVORITE_CATEGORY);
  const [variables, setVariables] = useState(initial?.variables.join(", ") ?? "");

  const submitting = createPrompt.isPending || updatePrompt.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const payload: PromptTemplateInput = {
      title: title.trim(),
      description: description.trim(),
      content,
      category: favorite ? FAVORITE_CATEGORY : category.trim(),
      variables: variables.split(",").map((v) => v.trim()).filter(Boolean),
    };
    if (initial) {
      updatePrompt.mutate({ id: initial.id, payload }, { onSuccess: onDone });
    } else {
      createPrompt.mutate(payload, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-title">Title</Label>
        <Input id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Code review checklist" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-description">Description</Label>
        <Input id="prompt-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line summary" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt-content">Content (Markdown)</Label>
        <Textarea id="prompt-content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="font-mono text-xs" placeholder={"Use {{variable}} for placeholders"} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt-category">Category</Label>
          <Input id="prompt-category" list="prompt-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. debugging" disabled={favorite} />
          <datalist id="prompt-categories">
            {realCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt-variables">Variables (comma-separated)</Label>
          <Input id="prompt-variables" value={variables} onChange={(e) => setVariables(e.target.value)} placeholder="language, framework" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="rounded border-white/20 bg-transparent" />
        <Star className="h-3.5 w-3.5" /> Mark as favorite
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={submitting || !title.trim() || !content.trim()}>{initial ? "Save changes" : "Save prompt"}</Button>
      </div>
    </form>
  );
}
