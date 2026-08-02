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
import { Card } from "@/components/ui/card";
import { formatDistanceToNowStrict } from "date-fns";
import { useTimelineEvents } from "@/hooks/useTimeline";

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

export function ProjectTimeline({ projectId }: { projectId: string }) {
  const { data: events, isLoading } = useTimelineEvents({ projectId, limit: 50 });

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading timeline…</div>;
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold mb-1">Timeline</h3>
      <p className="text-xs text-muted-foreground mb-4">Everything logged automatically as the project progresses.</p>

      {!events || events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Activity will show up here as you build this project out.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
          {events.map((event) => {
            const Icon = ICON_MAP[event.icon] ?? Activity;
            return (
              <li key={event.id} className="relative flex items-start gap-3 pl-0">
                <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-base-900">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-foreground/90">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
