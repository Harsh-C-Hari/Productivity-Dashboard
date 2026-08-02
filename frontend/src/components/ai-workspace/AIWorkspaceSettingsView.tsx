import { useEffect, useState } from "react";
import { Star, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAIAccounts } from "@/hooks/useAIAccounts";
import { getDefaultAccountId, setDefaultAccountId } from "@/lib/aiWorkspaceMeta";
import { useNotifications } from "@/context/NotificationContext";

export function AIWorkspaceSettingsView() {
  const { data: accounts } = useAIAccounts();
  const [defaultId, setDefaultIdState] = useState<string>("");
  const { toast } = useNotifications();

  useEffect(() => {
    setDefaultIdState(getDefaultAccountId() ?? "");
  }, []);

  function handleChange(value: string) {
    const next = value === "none" ? null : value;
    setDefaultAccountId(next);
    setDefaultIdState(next ?? "");
    toast(next ? "Default account updated" : "Default account cleared", "success");
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div>
        <h2 className="font-display text-lg font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">Workspace-wide preferences for AI Workspace.</p>
      </div>

      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Default AI account</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Pinned to the top of AI Accounts and preselected in the account picker. Stored on this device only.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label>Default account</Label>
          <Select value={defaultId || "none"} onValueChange={handleChange}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(accounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-secondary" />
          <h3 className="font-display text-sm font-semibold">About favorites, pins & token limits</h3>
        </div>
        <ul className="text-xs text-muted-foreground list-disc list-inside flex flex-col gap-1.5">
          <li>Favoriting a prompt or pinning/favoriting a knowledge article sets its <code className="text-primary">category</code> field to a reserved value, since there's no dedicated boolean column for either yet.</li>
          <li>Marking an account "limited" or "refreshed" logs an activity entry immediately — there's no persisted rate-limit window or scheduled refresh time on the backend.</li>
          <li>The countdown on each account card comes from a reminder <em>you</em> set (e.g. "resets at 9pm") — it's a local alarm, not a real usage reading from the provider, and it lives on this device only.</li>
          <li>The default account above is a per-device preference, not saved to the database.</li>
        </ul>
      </Card>
    </div>
  );
}
