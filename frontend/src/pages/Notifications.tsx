import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NOTIFICATION_CATEGORY_OPTIONS } from "@/lib/notificationMeta";
import { useNotificationsList, useMarkAllNotificationsRead, useNotificationCounts } from "@/hooks/useNotificationCenter";
import type { NotificationCategory } from "@/types/notifications";

type ReadFilter = "all" | "unread" | "read";

export default function Notifications() {
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [search, setSearch] = useState("");

  const { data: notifications, isLoading, isError } = useNotificationsList({
    is_read: readFilter === "all" ? undefined : readFilter === "read",
    category: category === "all" ? undefined : category,
    search: search.trim() || undefined,
  });
  const { data: counts } = useNotificationCounts();
  const markAllRead = useMarkAllNotificationsRead();

  const sorted = useMemo(
    () => [...(notifications ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {counts ? `${counts.unread} unread · ${counts.total} total` : "Loading…"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={!counts?.unread || markAllRead.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px] sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications…"
              className="pl-8 h-9 w-full sm:w-56"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NotificationCategory | "all")}
            className="h-9 rounded-xl border border-white/10 bg-base-900/60 px-3 text-xs text-muted-foreground outline-none focus:border-primary/50"
          >
            <option value="all">All categories</option>
            {NOTIFICATION_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card h-20 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Couldn't load notifications. Try refreshing the page.
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">You're all caught up</p>
          <p className="text-xs text-muted-foreground">
            {readFilter === "all" && category === "all" && !search
              ? "New invitations, reminders, and project updates will show up here."
              : "Nothing matches these filters."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
            >
              <NotificationRow notification={n} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
