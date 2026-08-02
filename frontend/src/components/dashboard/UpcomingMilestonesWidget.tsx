import { Link } from "react-router-dom";
import { Milestone as MilestoneIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDeadline, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/types";

export function UpcomingMilestonesWidget({ milestones }: { milestones: Milestone[] }) {
  const sorted = [...milestones].sort((a, b) => {
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
          <MilestoneIcon className="h-4 w-4 text-secondary" />
        </div>
        <CardTitle>Upcoming Milestones</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing on the horizon yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.slice(0, 5).map((m) => {
              const overdue = isOverdue(m.target_date);
              return (
                <Link
                  key={m.id}
                  to={`/projects/${m.project_id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm truncate">{m.title}</span>
                  {m.target_date && (
                    <span className={cn("text-xs shrink-0", overdue ? "text-urgency-critical" : "text-muted-foreground")}>
                      {formatDeadline(m.target_date)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
