import { Link } from "react-router-dom";
import {
  Activity,
  PlusCircle,
  Pencil,
  CheckCircle2,
  Trash2,
  Sparkles,
  Bug,
  FileText,
  Flag,
  ListTree,
  Link as LinkIcon,
  Paperclip,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNowStrict } from "date-fns";
import type { TimelineEvent } from "@/types";

const ICON_MAP: Record<string, typeof Activity> = {
  "plus-circle": PlusCircle,
  pencil: Pencil,
  "check-circle": CheckCircle2,
  "trash-2": Trash2,
  sparkles: Sparkles,
  bug: Bug,
  "file-text": FileText,
  flag: Flag,
  "list-tree": ListTree,
  link: LinkIcon,
  paperclip: Paperclip,
  activity: Activity,
};

export function ProjectTimelineWidget({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Activity className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Project Activity</CardTitle>
      </CardHeader>
      <div className="px-5 pb-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Activity will show up here as you build your projects out.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {events.slice(0, 6).map((event) => {
              const Icon = ICON_MAP[event.icon] ?? Activity;
              return (
                <li key={event.id} className="relative flex items-start gap-3 pl-0">
                  <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-base-900">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <Link to={`/projects/${event.project_id}`} className="min-w-0 flex-1 pt-0.5 hover:text-primary transition-colors">
                    <p className="text-sm text-foreground/90 truncate">{event.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
