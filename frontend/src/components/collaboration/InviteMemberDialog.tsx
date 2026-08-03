import { useState } from "react";
import { addDays, formatISO } from "date-fns";
import { Loader2, Mail, Link2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RoleBadge } from "./RoleBadge";
import { useRoles } from "@/hooks/useRoles";
import { useCreateProjectInvitation } from "@/hooks/useProjectInvitations";
import { useNotifications } from "@/context/NotificationContext";
import type { ProjectInvitation } from "@/types/collaboration";

interface InviteMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPIRY_OPTIONS = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

/** No SMTP is wired up (see task brief), so the moment an invitation is
 * created is the ONLY moment the owner has a natural reason to copy the
 * link -- closing the dialog and sending them hunting through the
 * Invitations tab for it is real, avoidable friction. On success this
 * now shows the link inline with a Copy button instead of closing
 * immediately; the same link is still always available later from
 * InvitationRow / InvitationDetailsDialog's "Copy invite link". */
export function InviteMemberDialog({ projectId, open, onOpenChange }: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("none");
  const [expiryDays, setExpiryDays] = useState("7");
  const [created, setCreated] = useState<ProjectInvitation | null>(null);
  const { data: roles } = useRoles({ projectId, includeGlobal: true });
  const createInvitation = useCreateProjectInvitation(projectId);
  const { toast } = useNotifications();

  const assignableRoles = (roles ?? []).filter((r) => r.name !== "Owner");

  function reset() {
    setEmail("");
    setRoleId("none");
    setExpiryDays("7");
    setCreated(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    createInvitation.mutate(
      {
        email: email.trim(),
        role_id: roleId === "none" ? null : roleId,
        expires_at: formatISO(addDays(new Date(), Number(expiryDays))),
      },
      {
        onSuccess: (invitation) => setCreated(invitation),
      }
    );
  }

  function copyLink(invitation: ProjectInvitation) {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${invitation.token}`);
    toast("Invite link copied", "success");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-urgency-low" /> Invitation sent
              </DialogTitle>
              <DialogDescription>
                {created.email} will see this in their notifications. You can also share the link below directly --
                there's no email delivery in this app.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label>Invite link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-xs">
                  {window.location.origin}/invite/{created.token}
                </code>
                <Button type="button" variant="secondary" size="icon" onClick={() => copyLink(created)}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreated(null);
                }}
              >
                Invite another
              </Button>
              <Button
                type="button"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Invite a member
              </DialogTitle>
              <DialogDescription>
                They must already have an account -- enter their registered email or username. They'll get an
                in-app notification, and you'll get a shareable link to send them too -- no email is sent
                automatically.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">Email or username</Label>
                <Input
                  id="invite-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com or username"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Role</Label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role</SelectItem>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Expires in</Label>
                  <Select value={expiryDays} onValueChange={setExpiryDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {roleId !== "none" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Will join with role: <RoleBadge role={assignableRoles.find((r) => r.id === roleId)} />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvitation.isPending || !email.trim()}>
                  {createInvitation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Send invitation
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
