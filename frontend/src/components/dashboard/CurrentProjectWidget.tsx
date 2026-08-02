import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProjectIcon } from "@/components/project-workspace/ProjectIcon";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { PROJECT_STATUS_META } from "@/lib/projectMeta";
import type { ProjectSummary } from "@/types";

/** Picks the "current" project as the most recently updated active
 * (non-archived, non-completed) project -- there's no explicit
 * "current project" concept on the backend, so this is derived
 * client-side the same way `overdue_only` filters are derived for todos. */
function pickCurrentProject(projects: ProjectSummary[]): ProjectSummary | null {
  const active = projects.filter((p) => p.project.status === "active" || p.project.status === "planning");
  const pool = active.length > 0 ? active : projects;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime())[0];
}

export function CurrentProjectWidget({ projects }: { projects: ProjectSummary[] }) {
  const current = pickCurrentProject(projects);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
          <Rocket className="h-4 w-4 text-secondary" />
        </div>
        <CardTitle>Current Project</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {!current ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Create a project to see it front and center here.
          </p>
        ) : (
          <Link
            to={`/projects/${current.project.id}`}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-base-900/40 p-3.5 hover:border-primary/30 transition-colors"
          >
            <ProgressRing progress={current.overall_progress} size={48} strokeWidth={4} color={subjectColorHex(current.project.color)}>
              <ProjectIcon
                icon={current.project.icon}
                className={`h-4 w-4 ${(SUBJECT_COLOR_CLASSES[current.project.color] ?? SUBJECT_COLOR_CLASSES.purple).text}`}
              />
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{current.project.name}</p>
              <p className="text-xs text-muted-foreground truncate mb-1.5">
                {current.project.description || "No description yet"}
              </p>
              <StatusBadge
                label={PROJECT_STATUS_META[current.project.status].label}
                colorClass={PROJECT_STATUS_META[current.project.status].color}
                textClass={PROJECT_STATUS_META[current.project.status].text}
                dotClass={PROJECT_STATUS_META[current.project.status].dot}
              />
            </div>
          </Link>
        )}
      </div>
    </Card>
  );
}
