import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotificationsList, useNotificationCounts } from "@/hooks/useNotificationCenter";
import { NOTIFICATION_CATEGORY_META } from "@/lib/notificationMeta";
import { formatDistanceToNow } from "date-fns";

/** Lightweight dashboard summary: unread count, pending invitations, and
 * the most recent few notifications -- see AI_HANDOFF.md "Dashboard"
 * ("Keep it lightweight"). Self-fetches like AIWorkspaceWidget rather
 * than going through /api/dashboard, same rationale (avoids a
 * DashboardOut schema change for this pass). */
export function NotificationsWidget() {
  const { data: counts } = useNotificationCounts();
  const { data: recent, isLoading } = useNotificationsList({ is_read: false });

  if (isLoading) return <div className="glass-card h-56 animate-pulse bg-white/[0.02]" />;
  if (!counts || counts.total === 0) return null;

  const items = (recent ?? []).slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <CardTitle>Notifications</CardTitle>
        </div>
        <Link to="/notifications" className="text-xs text-primary hover:underline">
          Open
        </Link>
      </CardHeader>

      <div className="px-5 pb-5 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
            <p className="font-mono text-lg font-semibold">{counts.unread}</p>
            <p className="text-[10px] text-muted-foreground">unread</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
            <p className="font-mono text-lg font-semibold">{counts.pending_invitations}</p>
            <p className="text-[10px] text-muted-foreground">pending invites</p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {items.map((n) => {
              const meta = NOTIFICATION_CATEGORY_META[n.category];
              const Icon = meta.icon;
              return (
                <Link
                  key={n.id}
                  to="/notifications"
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5 transition-colors"
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-sm truncate flex-1">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
