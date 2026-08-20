import { useEffect, useMemo, useState } from "react";
import { AlarmClock, X, Gauge, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { useUpdateAIAccount } from "@/hooks/useAIAccounts";
import {
  useAccountTokenTotal,
  useMarkAccountTokenLimited,
  useMarkAccountTokenRefreshed,
} from "@/hooks/useTokenTrackers";

/** Formats a millisecond duration as "2h 14m" / "42m" / "less than a minute". */
function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  if (totalMinutes < 1) return "less than a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Live countdown + quick actions for a single AI account's token
 * usage. The countdown is derived entirely from a reminder time the
 * *user* sets (persisted on `AIAccount.token_refresh_reminder_at`,
 * synced across every device/browser the account is opened from --
 * see models.py) -- there is no real provider-side `refresh_time`
 * anywhere in the system, so this never claims to know the actual
 * reset time, only the user's own reminder for it.
 *
 * "Mark limited" / "Mark refreshed" call the existing best-effort
 * ActivityLog endpoints (token_trackers.py) for the activity feed,
 * *and* persist `is_token_limited` on the account itself so the
 * "Limited" button's disabled state also follows the account across
 * devices instead of resetting per-browser.
 */
export function TokenRefreshCountdown({
  accountId,
  accountName,
  reminderAt,
  isLimited,
}: {
  accountId: string;
  accountName: string;
  reminderAt: string | null;
  isLimited: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftValue, setDraftValue] = useState("");

  const { data: total } = useAccountTokenTotal(accountId);
  const markLimited = useMarkAccountTokenLimited();
  const markRefreshed = useMarkAccountTokenRefreshed();
  const updateAccount = useUpdateAIAccount();

  // Tick once a minute -- token refresh windows are hours, not seconds,
  // so a faster interval would just burn cycles for no visible benefit.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const reminder = reminderAt;
  const remainingMs = reminder ? new Date(reminder).getTime() - now : null;
  const isOverdue = remainingMs !== null && remainingMs <= 0;

  const badge = useMemo(() => {
    if (isLimited) return { label: "Limited", colorClass: "bg-urgency-critical/15 border-urgency-critical/40", textClass: "text-urgency-critical", dotClass: "bg-urgency-critical" };
    if (remainingMs === null) return { label: "No reminder set", colorClass: "bg-white/10 border-white/20", textClass: "text-muted-foreground", dotClass: "bg-muted-foreground" };
    if (isOverdue) return { label: "Refresh due", colorClass: "bg-urgency-critical/15 border-urgency-critical/40", textClass: "text-urgency-critical", dotClass: "bg-urgency-critical" };
    if (remainingMs <= 15 * 60_000) return { label: `Refreshes in ${formatDuration(remainingMs)}`, colorClass: "bg-urgency-medium/15 border-urgency-medium/40", textClass: "text-urgency-medium", dotClass: "bg-urgency-medium" };
    return { label: `Refreshes in ${formatDuration(remainingMs)}`, colorClass: "bg-urgency-low/15 border-urgency-low/40", textClass: "text-urgency-low", dotClass: "bg-urgency-low" };
  }, [remainingMs, isOverdue, isLimited]);

  function openDialog() {
    // Default the input to ~5 hours from now, a common chat-app reset window,
    // purely as a convenient starting point -- not a claim about the real reset time.
    const fallback = reminder ?? new Date(Date.now() + 5 * 60 * 60_000).toISOString();
    setDraftValue(toLocalInputValue(fallback));
    setDialogOpen(true);
  }

  function handleSave() {
    if (!draftValue) return;
    const iso = new Date(draftValue).toISOString();
    updateAccount.mutate({ id: accountId, payload: { token_refresh_reminder_at: iso } });
    setDialogOpen(false);
  }

  function handleClearReminder() {
    updateAccount.mutate({ id: accountId, payload: { token_refresh_reminder_at: null } });
  }

  function handleMarkLimited() {
    markLimited.mutate(accountId);
    updateAccount.mutate({ id: accountId, payload: { is_token_limited: true } });
  }

  function handleMarkRefreshed() {
    markRefreshed.mutate(accountId);
    updateAccount.mutate({ id: accountId, payload: { is_token_limited: false, token_refresh_reminder_at: null } });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-base-900/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge {...badge} />
        {total && total.total_tokens > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ${total.total_estimated_cost_usd.toFixed(2)} tracked
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] gap-1" onClick={openDialog}>
          <AlarmClock className="h-3 w-3" /> {reminder ? "Edit reminder" : "Set reminder"}
        </Button>
        {reminder && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleClearReminder} aria-label="Clear reminder">
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] gap-1 text-urgency-critical disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleMarkLimited}
          disabled={markLimited.isPending || isLimited}
          title={isLimited ? "Already marked as limited" : "Mark as limited"}
        >
          <AlertTriangle className="h-3 w-3" /> {isLimited ? "Marked limited" : "Limited"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] gap-1 text-urgency-low"
          onClick={handleMarkRefreshed}
          disabled={markRefreshed.isPending}
        >
          <RotateCcw className="h-3 w-3" /> Refreshed
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gauge className="h-4 w-4" /> Token refresh reminder</DialogTitle>
            <DialogDescription>
              A personal reminder for {accountName} -- synced to your account, so it shows up on every device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-time">Remind me at</Label>
            <Input
              id="reminder-time"
              type="datetime-local"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!draftValue}>Save reminder</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
