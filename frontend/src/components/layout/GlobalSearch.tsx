import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils";
import type { GlobalSearchItem } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  task: "Task",
  subject: "Subject",
  assignment: "Assignment",
  note: "Note",
  project: "Project",
  todo: "Todo",
  feature: "Feature",
  bug: "Bug",
  milestone: "Milestone",
  ai_account: "AI Account",
  conversation: "Conversation",
  prompt_template: "Prompt",
  knowledge_article: "Knowledge",
  project_zip: "Zip",
  ai_handoff: "Handoff",
};

/** App-wide command-palette search (Ctrl/Cmd+K). Spans Tasks, Study
 * Hub, and Project Workspace via the `/api/search` endpoint and
 * navigates to the owning page on selection. Fully keyboard operable:
 * arrow keys move the highlight, Enter selects, Escape closes. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearch(query);
  const results = data?.results ?? [];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [results.length]);

  function select(item: GlobalSearchItem) {
    setOpen(false);
    navigate(item.path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Open global search"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search everything…</span>
          <kbd className="hidden sm:inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 glass-panel rounded-2xl shadow-glass overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Global search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search tasks, study hub, and projects. Use arrow keys to navigate results, Enter to open.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, projects, notes, and more…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search query"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
            />
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div id="global-search-results" role="listbox" className="max-h-80 overflow-y-auto scrollbar-thin p-2">
            {query.trim().length <= 1 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Start typing to search across the whole app.
              </p>
            )}

            {query.trim().length > 1 && !isFetching && results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results for "{query}".
              </p>
            )}

            {results.map((item, i) => (
              <button
                key={`${item.type}-${item.id}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(item)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  i === activeIndex ? "bg-primary/15 text-foreground" : "hover:bg-white/[0.04]"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  {i === activeIndex && <CornerDownLeft className="h-3 w-3 text-muted-foreground" />}
                </span>
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
