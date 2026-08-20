import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, ListChecks, CalendarClock, GraduationCap, FolderKanban, Bot, Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/collaboration/ConfirmDialog";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timetable", label: "Timetable", icon: CalendarClock },
  { to: "/study-hub", label: "Study Hub", icon: GraduationCap },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/ai-workspace", label: "AI Workspace", icon: Bot },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutConfirmOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-white/[0.06] bg-base-950/60 backdrop-blur-xl p-4">
      <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Zap className="h-4.5 w-4.5 text-primary-foreground" fill="currentColor" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm leading-tight">Prod Dashboard</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Level up your workflow</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-base-800/50 p-3.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tip: use the <span className="text-primary font-medium">+ button</span> anywhere to
            quick-capture a task in seconds.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-base-900/40 p-2">
            <NavLink
              to="/profile"
              className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 text-primary">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold">
                    {(user.display_name || user.username).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{user.display_name || user.username}</p>
                <p className="truncate text-[11px] text-muted-foreground">View profile</p>
              </div>
            </NavLink>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              title="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-urgency-critical/10 hover:text-urgency-critical"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="Log out?"
        description="You'll need to sign in again to access your dashboard."
        confirmLabel="Log out"
        loading={isLoggingOut}
        onConfirm={handleConfirmLogout}
      />
    </aside>
  );
}