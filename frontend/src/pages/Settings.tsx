import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Info, Palette, Github, MonitorSmartphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/context/NotificationContext";
import {
  getDevicePushState,
  subscribeToPush,
  unsubscribeFromPush,
  type DevicePushState,
} from "@/lib/push";

export default function Settings() {
  const { permission, requestPermission, notify, toast } = useNotifications();

  // Background delivery (Web Push) -- per-device opt-in. Entirely separate
  // from the browser-permission row above: that one keeps its exact
  // behavior; this only adds server-side push so alerts arrive with the
  // app closed.
  const [pushState, setPushState] = useState<DevicePushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getDevicePushState()
      .then(setPushState)
      .catch(() => setPushState(null));
  }, []);

  async function enableBackgroundAlerts() {
    setPushBusy(true);
    try {
      await subscribeToPush();
      // subscribeToPush may have just requested notification permission;
      // re-sync the context (a no-op prompt-wise when already granted) so
      // the browser-permission row above reflects it immediately.
      await requestPermission();
      toast("Background alerts enabled on this device", "success");
      setPushState(await getDevicePushState());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not enable background alerts", "warning");
      setPushState(await getDevicePushState());
    } finally {
      setPushBusy(false);
    }
  }

  async function disableBackgroundAlerts() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      toast("Background alerts disabled on this device", "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not disable background alerts", "warning");
    } finally {
      setPushState(await getDevicePushState());
      setPushBusy(false);
    }
  }

  function sendTestNotification() {
    if (permission !== "granted") {
      toast("Enable notifications first", "warning");
      return;
    }
    notify("Test notification", "This is what a deadline alert looks like.");
    toast("Test notification sent", "success");
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 max-w-2xl"
    >
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CardDescription>
            Get browser alerts when a task's deadline is within the hour, and once when it becomes
            overdue. Alerts are checked automatically while the dashboard tab is open.
          </CardDescription>

          <div className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-base-900/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {permission === "granted" ? (
                <BellRing className="h-4 w-4 shrink-0 text-urgency-low" />
              ) : (
                <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {permission === "granted"
                    ? "Alerts are enabled"
                    : permission === "unsupported"
                    ? "Not supported in this browser"
                    : "Alerts are off"}
                </p>
                <p className="truncate text-xs text-muted-foreground">Browser Notification API</p>
              </div>
            </div>
            {permission !== "granted" && permission !== "unsupported" && (
              <Button size="sm" onClick={requestPermission} className="w-full sm:w-auto">
                Enable
              </Button>
            )}
          </div>

          <Button variant="secondary" onClick={sendTestNotification} className="self-start">
            Send test notification
          </Button>

          <Separator />

          <CardDescription>
            Install the app on your phone (browser menu → "Add to Home screen") and enable
            background delivery below to also receive these alerts as system notifications with
            the app fully closed.
          </CardDescription>

          <div className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-base-900/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {pushState?.subscribed ? (
                <MonitorSmartphone className="h-4 w-4 shrink-0 text-urgency-low" />
              ) : (
                <MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {!pushState
                    ? "Checking this device…"
                    : !pushState.supported
                    ? "Not available on this device/browser"
                    : pushState.subscribed
                    ? "Background alerts are on"
                    : "Receive alerts even when closed"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Web Push · installed app, works offline of the browser
                </p>
              </div>
            </div>
            {pushState?.supported && (
              pushState.subscribed ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pushBusy}
                  onClick={disableBackgroundAlerts}
                  className="w-full sm:w-auto"
                >
                  Disable
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={pushBusy}
                  onClick={enableBackgroundAlerts}
                  className="w-full sm:w-auto"
                >
                  {pushBusy ? "Enabling…" : "Enable push on this device"}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
            <Palette className="h-4 w-4 text-secondary" />
          </div>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            This MVP ships with a single calm, minimal dark theme (warm neutral surfaces with a
            restrained amber accent). Light mode isn't implemented yet.
          </CardDescription>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Info className="h-4 w-4 text-accent" />
          </div>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CardDescription>
            Personal Productivity Dashboard — a self-hosted PWA for tracking tasks, deadlines,
            and your weekly timetable, with urgency automatically calculated from remaining
            time, effort, and progress.
          </CardDescription>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Github className="h-3.5 w-3.5" />
            React · Vite · TypeScript · Tailwind · FastAPI · SQLite
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
