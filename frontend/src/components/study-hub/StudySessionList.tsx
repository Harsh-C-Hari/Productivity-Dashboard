import { format, formatDistanceToNowStrict } from "date-fns";
import { History, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStudySessions, useDeleteStudySession } from "@/hooks/useStudySessions";
import { SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";

interface StudySessionListProps {
  subjectId?: string;
  limit?: number;
}

export function StudySessionList({ subjectId, limit = 20 }: StudySessionListProps) {
  const { data: sessions, isLoading } = useStudySessions({ subjectId, limit });
  const deleteSession = useDeleteStudySession();

  const completed = (sessions ?? []).filter((s) => s.ended_at);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
          <History className="h-4 w-4 text-secondary" />
        </div>
        <CardTitle>Session Log</CardTitle>
      </CardHeader>
      <div className="px-5 pb-5">
        {isLoading && <div className="h-24 animate-pulse bg-white/[0.02] rounded-lg" />}

        {!isLoading && completed.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No study sessions logged yet — start the timer above.
          </p>
        )}

        <ul className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto scrollbar-thin">
          {completed.map((session) => {
            const colorClasses = SUBJECT_COLOR_CLASSES[session.subject_color ?? "purple"] ?? SUBJECT_COLOR_CLASSES.purple;
            return (
              <li
                key={session.id}
                className="group flex items-center gap-3 rounded-lg border border-white/10 bg-base-900/40 px-3 py-2"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${colorClasses.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{session.subject_name ?? "Unassigned"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(session.started_at), "MMM d, h:mm a")} ·{" "}
                    {formatDistanceToNowStrict(new Date(session.started_at), { addSuffix: true })}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{session.duration_minutes}m</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-urgency-critical transition-opacity"
                  onClick={() => deleteSession.mutate(session.id)}
                  aria-label="Delete session"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
