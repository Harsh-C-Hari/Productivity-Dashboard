import { format } from "date-fns";
import { Timer } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import type { StudySession } from "@/types";

export function TodayStudySessions({ sessions }: { sessions: StudySession[] }) {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Timer className="h-4 w-4 text-accent" />
          </div>
          <CardTitle>Today's Study Sessions</CardTitle>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{totalMinutes}m total</span>
      </CardHeader>
      <div className="flex flex-col gap-2 px-5 pb-5 max-h-[340px] overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No study time logged yet today — the timer is on the Study Hub page.
          </p>
        ) : (
          sessions.map((session) => {
            const colorClasses = SUBJECT_COLOR_CLASSES[session.subject_color ?? "purple"] ?? SUBJECT_COLOR_CLASSES.purple;
            return (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-base-900/40 px-3 py-2.5"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${colorClasses.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{session.subject_name ?? "Unassigned"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(session.started_at), "h:mm a")}
                    {session.ended_at ? ` – ${format(new Date(session.ended_at), "h:mm a")}` : " · in progress"}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {session.ended_at ? `${session.duration_minutes}m` : "..."}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
