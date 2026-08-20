import { NavLink } from "react-router-dom";
import { LayoutDashboard, ListChecks, CalendarClock, GraduationCap, FolderKanban, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timetable", label: "Schedule", icon: CalendarClock },
  { to: "/study-hub", label: "Study", icon: GraduationCap },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/ai-workspace", label: "AI", icon: Bot },
];

export function MobileNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-base-950/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex items-stretch gap-0.5 px-1 py-1.5 justify-around">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex min-w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}