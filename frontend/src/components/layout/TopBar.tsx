import { useEffect, useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { useNotificationCounts } from "@/hooks/useNotificationCenter";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your mission control for today" },
  "/tasks": { title: "Tasks", subtitle: "Everything on your plate" },
  "/timetable": { title: "Timetable", subtitle: "Your weekly schedule" },
  "/projects": { title: "Projects", subtitle: "Every project, phase, and bug in one place" },
  "/notifications": { title: "Notifications", subtitle: "Invitations, reminders, and updates" },
  "/settings": { title: "Settings", subtitle: "Tune your dashboard" },
  "/profile": { title: "Profile", subtitle: "Your account, security, and sessions" },
};

export function TopBar() {
  const { pathname } = useLocation();
  const { permission, requestPermission } = useNotifications();
  const { user } = useAuth();
  const { data: counts } = useNotificationCounts();
  const [now, setNow] = useState(new Date());
  const meta = TITLES[pathname] ?? TITLES["/"];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06] bg-base-950/40 backdrop-blur-xl sticky top-0 z-30">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <GlobalSearch />

        <span className="hidden sm:inline-block font-mono text-xs text-muted-foreground tabular-nums">
          {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          {" · "}
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>

        <NavLink
          to="/notifications"
          title="Notifications"
          className="relative hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:text-foreground hover:bg-white/5"
        >
          <Bell className="h-4 w-4" />
          {!!counts?.unread && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 animate-in zoom-in-95 fade-in duration-200 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {counts.unread > 9 ? "9+" : counts.unread}
            </span>
          )}
        </NavLink>

        {permission === "granted" ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-urgency-low/30 bg-urgency-low/10 text-urgency-low"
            title="Deadline notifications are on"
          >
            <BellRing className="h-4 w-4" />
          </div>
        ) : permission === "unsupported" ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted-foreground/50"
            title="Notifications aren't supported in this browser"
          >
            <BellOff className="h-4 w-4" />
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={requestPermission} className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Enable alerts</span>
          </Button>
        )}

        {user && (
          <NavLink
            to="/profile"
            title="Profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-primary/15 text-primary md:hidden"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold">
                {(user.display_name || user.username).slice(0, 1).toUpperCase()}
              </span>
            )}
          </NavLink>
        )}
      </div>
    </header>
  );
}
