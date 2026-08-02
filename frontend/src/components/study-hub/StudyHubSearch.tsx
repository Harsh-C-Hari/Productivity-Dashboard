import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BookOpen, ListChecks, NotebookPen, Paperclip, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStudyHubSearch } from "@/hooks/useStudyHub";
import { cn } from "@/lib/utils";

export function StudyHubSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useStudyHubSearch(query);
  const navigate = useNavigate();

  const hasResults =
    data && (data.subjects.length + data.assignments.length + data.notes.length + data.resources.length > 0);

  function goToSubject(subjectId: string) {
    setOpen(false);
    setQuery("");
    navigate(`/study-hub/${subjectId}`);
  }

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search subjects, assignments, notes, resources..."
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
              <ResultGroup icon={BookOpen} label="Subjects" show={data.subjects.length > 0}>
                {data.subjects.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={() => goToSubject(s.id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    {s.name} {s.code && <span className="text-muted-foreground text-xs">· {s.code}</span>}
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={ListChecks} label="Assignments" show={data.assignments.length > 0}>
                {data.assignments.map((a) => (
                  <button
                    key={a.id}
                    onMouseDown={() => goToSubject(a.subject_id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{a.title}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{a.subject_name}</span>
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={NotebookPen} label="Notes" show={data.notes.length > 0}>
                {data.notes.map((n) => (
                  <button
                    key={n.id}
                    onMouseDown={() => goToSubject(n.subject_id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{n.title}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{n.subject_name}</span>
                  </button>
                ))}
              </ResultGroup>

              <ResultGroup icon={Paperclip} label="Resources" show={data.resources.length > 0}>
                {data.resources.map((r) => (
                  <button
                    key={r.id}
                    onMouseDown={() => goToSubject(r.subject_id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{r.title}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{r.subject_name}</span>
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
