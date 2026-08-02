import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Library, Plus, Search, Pencil, Trash2, Star, Pin, Tag, Sparkles, FolderKanban } from "lucide-react";
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
  useKnowledgeArticles,
  useKnowledgeCategories,
  useCreateKnowledgeArticle,
  useUpdateKnowledgeArticle,
  useDeleteKnowledgeArticle,
} from "@/hooks/useKnowledgeArticles";
import { useProjects } from "@/hooks/useProjects";
import { PINNED_CATEGORY, FAVORITE_CATEGORY, KNOWLEDGE_SOURCE_META } from "@/lib/aiWorkspaceMeta";
import type { KnowledgeArticle, KnowledgeArticleInput } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function KnowledgeBaseView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewArticle, setViewArticle] = useState<KnowledgeArticle | null>(null);
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeArticle | null>(null);

  const { data: articles, isLoading } = useKnowledgeArticles({
    q: search.trim() || undefined,
    category: category === "all" ? undefined : category,
    pinnedOnly: pinnedOnly || undefined,
    favoritesOnly: favoritesOnly || undefined,
  });
  const { data: categories } = useKnowledgeCategories();
  const { data: projects } = useProjects();
  const deleteArticle = useDeleteKnowledgeArticle();
  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const realCategories = useMemo(
    () => (categories ?? []).filter((c) => c !== PINNED_CATEGORY && c !== FAVORITE_CATEGORY),
    [categories]
  );

  const sorted = useMemo(
    () =>
      [...(articles ?? [])].sort((a, b) => {
        const aPinned = a.category === PINNED_CATEGORY ? 1 : 0;
        const bPinned = b.category === PINNED_CATEGORY ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [articles]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Knowledge Base</h2>
          <p className="text-xs text-muted-foreground">Notes and learnings worth keeping around.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="pl-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {realCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={pinnedOnly ? "default" : "outline"} size="sm" className="gap-1.5 shrink-0" onClick={() => setPinnedOnly((v) => !v)}>
            <Pin className="h-3.5 w-3.5" /> Pinned
          </Button>
          <Button variant={favoritesOnly ? "default" : "outline"} size="sm" className="gap-1.5 shrink-0" onClick={() => setFavoritesOnly((v) => !v)}>
            <Star className="h-3.5 w-3.5" /> Favorites
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New article
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-40 animate-pulse bg-white/[0.02]" />)}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Library className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">No articles yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search || pinnedOnly || favoritesOnly ? "Try a different filter." : "Capture useful patterns, gotchas, and decisions here."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((article) => {
            const project = article.project_id ? projectsById.get(article.project_id) : undefined;
            const sourceMeta = KNOWLEDGE_SOURCE_META[article.source];
            const isPinned = article.category === PINNED_CATEGORY;
            const isFavorite = article.category === FAVORITE_CATEGORY;
            return (
              <motion.div key={article.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
                <Card className="group p-4 flex flex-col gap-2.5 cursor-pointer" onClick={() => setViewArticle(article)}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-sm line-clamp-1">{article.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPinned && <Pin className="h-3.5 w-3.5 fill-secondary text-secondary" />}
                      {isFavorite && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.2em]">{article.content || "Empty article"}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isPinned && !isFavorite && article.category && (
                      <StatusBadge label={article.category} colorClass="bg-secondary/15 border-secondary/40" textClass="text-secondary" dotClass="bg-secondary" />
                    )}
                    <StatusBadge label={sourceMeta.label} colorClass={sourceMeta.color} textClass={sourceMeta.text} dotClass={sourceMeta.dot} />
                    {article.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground flex items-center gap-1"><Tag className="h-2.5 w-2.5" />{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">{project ? <><FolderKanban className="h-3 w-3" /> {project.name}</> : "Global"}</span>
                    <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditArticle(article)} aria-label="Edit article"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-urgency-critical" onClick={() => setConfirmDelete(article)} aria-label="Delete article"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New article</DialogTitle>
            <DialogDescription>Capture something worth remembering.</DialogDescription>
          </DialogHeader>
          <KnowledgeArticleForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editArticle} onOpenChange={(open) => !open && setEditArticle(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit article</DialogTitle>
          </DialogHeader>
          {editArticle && <KnowledgeArticleForm initial={editArticle} onDone={() => setEditArticle(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewArticle} onOpenChange={(open) => !open && setViewArticle(null)}>
        <DialogContent className="max-w-xl">
          {viewArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {viewArticle.title}
                  {viewArticle.category === PINNED_CATEGORY && <Pin className="h-4 w-4 fill-secondary text-secondary" />}
                  {viewArticle.category === FAVORITE_CATEGORY && <Star className="h-4 w-4 fill-primary text-primary" />}
                  {viewArticle.source === "ai_generated" && <Sparkles className="h-4 w-4 text-primary" />}
                </DialogTitle>
              </DialogHeader>
              <div
                className="rounded-xl border border-white/10 bg-base-900/50 p-4 max-h-96 overflow-y-auto prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-display [&_h2]:text-base [&_h2]:font-display [&_code]:text-primary [&_a]:text-secondary"
                dangerouslySetInnerHTML={{ __html: renderMarkdownLite(viewArticle.content) || "<p class='italic text-muted-foreground'>Empty article</p>" }}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 flex-wrap">{viewArticle.tags.map((t) => <span key={t} className="rounded-full border border-white/10 px-2 py-0.5">{t}</span>)}</span>
                <span>updated {formatDistanceToNow(new Date(viewArticle.updated_at), { addSuffix: true })}</span>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setViewArticle(null)}>Close</Button>
                <Button className="gap-1.5" onClick={() => { setEditArticle(viewArticle); setViewArticle(null); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{confirmDelete?.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmDelete) deleteArticle.mutate(confirmDelete.id); setConfirmDelete(null); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KnowledgeArticleForm({ initial, onDone }: { initial?: KnowledgeArticle; onDone: () => void }) {
  const { data: projects } = useProjects();
  const { data: categories } = useKnowledgeCategories();
  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const realCategories = (categories ?? []).filter((c) => c !== PINNED_CATEGORY && c !== FAVORITE_CATEGORY);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [category, setCategory] = useState(
    initial && initial.category !== PINNED_CATEGORY && initial.category !== FAVORITE_CATEGORY ? initial.category : ""
  );
  const [pinned, setPinned] = useState(initial?.category === PINNED_CATEGORY);
  const [favorite, setFavorite] = useState(initial?.category === FAVORITE_CATEGORY);
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");

  const submitting = createArticle.isPending || updateArticle.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const resolvedCategory = pinned ? PINNED_CATEGORY : favorite ? FAVORITE_CATEGORY : category.trim();
    const payload: KnowledgeArticleInput = {
      title: title.trim(),
      content,
      project_id: projectId || undefined,
      category: resolvedCategory,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      source: initial?.source ?? "manual",
    };
    if (initial) {
      updateArticle.mutate(
        { id: initial.id, payload: { ...payload, clear_project: !projectId } },
        { onSuccess: onDone }
      );
    } else {
      createArticle.mutate(payload, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-title">Title</Label>
        <Input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why we retry on 429s" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-content">Content (Markdown)</Label>
        <Textarea id="article-content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="font-mono text-xs" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Project (optional)</Label>
          <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Global (no project)</SelectItem>
              {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-category">Category</Label>
          <Input id="article-category" list="knowledge-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. architecture" disabled={pinned || favorite} />
          <datalist id="knowledge-categories">
            {realCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-tags">Tags (comma-separated)</Label>
        <Input id="article-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="auth, retries, api" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={pinned} onChange={(e) => { setPinned(e.target.checked); if (e.target.checked) setFavorite(false); }} className="rounded border-white/20 bg-transparent" />
          <Pin className="h-3.5 w-3.5" /> Pin to top
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={favorite} onChange={(e) => { setFavorite(e.target.checked); if (e.target.checked) setPinned(false); }} className="rounded border-white/20 bg-transparent" />
          <Star className="h-3.5 w-3.5" /> Favorite
        </label>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={submitting || !title.trim()}>{initial ? "Save changes" : "Save article"}</Button>
      </div>
    </form>
  );
}
