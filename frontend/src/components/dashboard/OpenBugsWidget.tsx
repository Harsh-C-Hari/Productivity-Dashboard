import { Link } from "react-router-dom";
import { Bug as BugIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { useBugs } from "@/hooks/useBugs";
import { BUG_SEVERITY_META } from "@/lib/projectMeta";

export function OpenBugsWidget() {
  const { data: bugs, isLoading } = useBugs({ status: "open", sortBy: "severity", sortOrder: "asc", limit: 5 });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-urgency-critical/10">
          <BugIcon className="h-4 w-4 text-urgency-critical" />
        </div>
        <CardTitle>Open Bugs</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="h-20 animate-pulse bg-white/[0.02] rounded-xl" />
        ) : !bugs || bugs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No open bugs — nice work.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bugs.map((bug) => {
              const meta = BUG_SEVERITY_META[bug.severity];
              return (
                <Link
                  key={bug.id}
                  to={`/projects/${bug.project_id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm truncate">{bug.title}</span>
                  <StatusBadge label={meta.label} colorClass={meta.color} textClass={meta.text} dotClass={meta.dot} className="shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
