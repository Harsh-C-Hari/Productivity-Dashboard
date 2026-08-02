import { Laptop, Smartphone, Monitor, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Session } from "@/types/auth";

function deviceIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("android") || p.includes("ios")) return Smartphone;
  if (p.includes("mac") || p.includes("win") || p.includes("linux")) return Laptop;
  return Monitor;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Unknown";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const Icon = deviceIcon(session.platform);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-base-900/40 p-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            session.is_current ? "bg-primary/15 text-primary" : "bg-base-800 text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {session.device || session.browser || "Unknown device"}
            {session.is_current && (
              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                This device
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session.ip_address ? `${session.ip_address} · ` : ""}
            Active {formatRelative(session.last_active_at)}
          </p>
        </div>
      </div>

      {!session.is_current && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-urgency-critical hover:bg-urgency-critical/10 hover:text-urgency-critical"
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
        >
          <ShieldOff className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
