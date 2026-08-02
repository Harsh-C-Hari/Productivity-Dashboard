import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { usePhases } from "@/hooks/usePhases";
import { PHASE_STATUS_META } from "@/lib/projectMeta";
import type { ProjectSummary } from "@/types";

function pickCurrentProject(projects: ProjectSummary[]): ProjectSummary | null {
  const active = projects.filter((p) => p.project.status === "active" || p.project.status === "planning");
  const pool = active.length > 0 ? active : projects;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime())[0];
}

export function CurrentPhaseWidget({ projects }: { projects: ProjectSummary[] }) {
  const current = pickCurrentProject(projects);
  const { data: phases, isLoading } = usePhases({ projectId: current?.project.id });

  const sorted = [...(phases ?? [])].sort((a, b) => a.order_index - b.order_index);
  const currentPhase = sorted.find((p) => p.status === "in_progress") ?? sorted.find((p) => p.status === "pending") ?? null;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <GitBranch className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Current Phase</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {!current ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active project yet.</p>
        ) : isLoading ? (
          <div className="h-16 animate-pulse bg-white/[0.02] rounded-xl" />
        ) : !currentPhase ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {current.project.name} has no phases in the roadmap yet.
          </p>
        ) : (
          <Link
            to={`/projects/${current.project.id}`}
            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-base-900/40 p-3.5 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">{currentPhase.title}</p>
              <StatusBadge
                label={PHASE_STATUS_META[currentPhase.status].label}
                colorClass={PHASE_STATUS_META[currentPhase.status].color}
                textClass={PHASE_STATUS_META[currentPhase.status].text}
                dotClass={PHASE_STATUS_META[currentPhase.status].dot}
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">{current.project.name}</p>
            <div className="flex items-center gap-2">
              <Progress value={currentPhase.progress} className="h-1.5 flex-1" />
              <span className="text-[11px] font-mono text-muted-foreground w-9 text-right">{currentPhase.progress}%</span>
            </div>
          </Link>
        )}
      </div>
    </Card>
  );
}
