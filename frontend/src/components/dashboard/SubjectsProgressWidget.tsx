import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import type { SubjectProgress } from "@/types";

export function SubjectsProgressWidget({ subjects }: { subjects: SubjectProgress[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>Subject Progress</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Add a subject in Study Hub to start tracking progress here.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
            {subjects.map((sp) => {
              const colorClasses = SUBJECT_COLOR_CLASSES[sp.subject.color] ?? SUBJECT_COLOR_CLASSES.purple;
              return (
                <Link
                  key={sp.subject.id}
                  to={`/study-hub/${sp.subject.id}`}
                  className="flex min-w-[136px] shrink-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-base-900/40 p-3 hover:border-primary/30 transition-colors"
                >
                  <ProgressRing progress={sp.completion_rate} size={52} strokeWidth={4} color={subjectColorHex(sp.subject.color)}>
                    <span className="font-mono text-[10px] font-semibold">{sp.completion_rate}%</span>
                  </ProgressRing>
                  <p className={`text-xs font-medium text-center truncate w-full ${colorClasses.text}`}>{sp.subject.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {sp.completed_assignments}/{sp.total_assignments} done
                    {sp.overdue_assignments > 0 && (
                      <span className="text-urgency-critical"> · {sp.overdue_assignments} overdue</span>
                    )}
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
