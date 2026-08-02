import { NavLink } from "react-router-dom";
import { LayoutDashboard, ListChecks, CalendarClock, Settings, GraduationCap, FolderKanban, Bot, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationCounts } from "@/hooks/useNotificationCenter";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timetable", label: "Schedule", icon: CalendarClock },
  { to: "/study-hub", label: "Study", icon: GraduationCap },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/ai-workspace", label: "AI", icon: Bot },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const { data: counts } = useNotificationCounts();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-base-950/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-0.5 py-2 overflow-x-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[9px] font-medium transition-colors shrink-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "relative flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {to === "/notifications" && !!counts?.unread && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 animate-in zoom-in-95 fade-in duration-200 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground">
                      {counts.unread > 9 ? "9+" : counts.unread}
                    </span>
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
