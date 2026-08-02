import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban, ListChecks, Layers, Bug as BugIcon, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProjectWorkspaceSearch } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

export function ProjectSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useProjectWorkspaceSearch(query);
  const navigate = useNavigate();

  const hasResults =
    data &&
    data.projects.length + data.todos.length + data.features.length + data.bugs.length + data.documents.length + data.resources.length > 0;

  function goToProject(projectId: string) {
    setOpen(false);
    setQuery("");
    navigate(`/projects/${projectId}`);
  }

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search projects, todos, features, bugs..."
        className="pl-8"
      />

      {open && query.trim().length > 1 && (
        <div className="absolute z-50 mt-2 w-full glass-panel rounded-xl shadow-glass max-h-[400px] overflow-y-auto scrollbar-thin">
          {isFetching && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
            </div>
          )}

          {!isFetching && !hasResults && (
            <p className="py-6 text-center text-sm text-muted-foreground">No matches for "{query}"</p>
          )}

          {!isFetching && data && (
            <div className="flex flex-col py-1">
              <ResultGroup icon={FolderKanban} label="Projects" show={data.projects.length > 0}>
                {data.projects.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => goToProject(p.id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={ListChecks} label="Todos" show={data.todos.length > 0}>
                {data.todos.map((t) => (
                  <button
                    key={t.id}
                    onMouseDown={() => goToProject(t.project_id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{t.title}</span>
                    {t.phase_title && <span className="text-muted-foreground text-xs shrink-0">{t.phase_title}</span>}
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={Layers} label="Features" show={data.features.length > 0}>
                {data.features.map((f) => (
                  <button
                    key={f.id}
                    onMouseDown={() => goToProject(f.project_id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{f.title}</span>
                    {f.phase_title && <span className="text-muted-foreground text-xs shrink-0">{f.phase_title}</span>}
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={BugIcon} label="Bugs" show={data.bugs.length > 0}>
                {data.bugs.map((b) => (
                  <button
                    key={b.id}
                    onMouseDown={() => goToProject(b.project_id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{b.title}</span>
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={FileText} label="Documentation" show={data.documents.length > 0}>
                {data.documents.map((d) => (
                  <button
                    key={d.id}
                    onMouseDown={() => goToProject(d.project_id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{d.title}</span>
                  </button>
                ))}
              </ResultGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  icon: Icon,
  label,
  show,
  children,
}: {
  icon: typeof Search;
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className={cn("py-1")}>
      <p className="flex items-center gap-1.5 px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      {children}
    </div>
  );
}
