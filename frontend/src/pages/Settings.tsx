import { motion } from "framer-motion";
import { Bell, BellRing, Info, Palette, Github } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/context/NotificationContext";

export default function Settings() {
  const { permission, requestPermission, notify, toast } = useNotifications();

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

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-base-900/40 p-3.5">
            <div className="flex items-center gap-2">
              {permission === "granted" ? (
                <BellRing className="h-4 w-4 text-urgency-low" />
              ) : (
                <Bell className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {permission === "granted"
                    ? "Alerts are enabled"
                    : permission === "unsupported"
                    ? "Not supported in this browser"
                    : "Alerts are off"}
                </p>
                <p className="text-xs text-muted-foreground">Browser Notification API</p>
              </div>
            </div>
            {permission !== "granted" && permission !== "unsupported" && (
              <Button size="sm" onClick={requestPermission}>
                Enable
              </Button>
            )}
          </div>

          <Button variant="secondary" onClick={sendTestNotification} className="self-start">
            Send test notification
          </Button>
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
            This MVP ships with a single gaming-inspired dark theme (purple + blue accents,
            glassmorphism panels). Light mode isn't implemented yet.
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
