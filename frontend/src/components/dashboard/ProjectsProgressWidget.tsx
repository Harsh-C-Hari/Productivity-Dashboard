import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import type { ProjectSummary } from "@/types";

export function ProjectsProgressWidget({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <FolderKanban className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>Project Progress</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Create a project to start tracking progress here.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
            {projects.map((ps) => {
              const colorClasses = SUBJECT_COLOR_CLASSES[ps.project.color] ?? SUBJECT_COLOR_CLASSES.purple;
              return (
                <Link
                  key={ps.project.id}
                  to={`/projects/${ps.project.id}`}
                  className="flex min-w-[136px] shrink-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-base-900/40 p-3 hover:border-primary/30 transition-colors"
                >
                  <ProgressRing progress={ps.overall_progress} size={52} strokeWidth={4} color={subjectColorHex(ps.project.color)}>
                    <span className="font-mono text-[10px] font-semibold">{Math.round(ps.overall_progress)}%</span>
                  </ProgressRing>
                  <p className={`text-xs font-medium text-center truncate w-full ${colorClasses.text}`}>{ps.project.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ps.completed_todo_count}/{ps.todo_count} done
                    {ps.open_bug_count > 0 && <span className="text-urgency-critical"> · {ps.open_bug_count} bugs</span>}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
