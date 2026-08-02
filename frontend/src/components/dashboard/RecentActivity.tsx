import {
  Activity,
  PlusCircle,
  Pencil,
  CheckCircle2,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNowStrict } from "date-fns";
import type { ActivityEntry } from "@/types";

const ICON_MAP: Record<string, typeof Activity> = {
  "plus-circle": PlusCircle,
  pencil: Pencil,
  "check-circle": CheckCircle2,
  "trash-2": Trash2,
  sparkles: Sparkles,
  activity: Activity,
};

export function RecentActivity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Activity className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <div className="px-5 pb-5">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Activity will show up here as you use the dashboard.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {entries.map((entry) => {
              const Icon = ICON_MAP[entry.icon] ?? Activity;
              return (
                <li key={entry.id} className="relative flex items-start gap-3 pl-0">
                  <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-base-900">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-foreground/90 truncate">{entry.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
