import { format } from "date-fns";
import { Link2, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RoleBadge } from "./RoleBadge";
import { INVITATION_STATUS_META } from "@/lib/collaborationMeta";
import { useNotifications } from "@/context/NotificationContext";
import type { ProjectInvitation, Role } from "@/types/collaboration";

interface InvitationDetailsDialogProps {
  invitation: ProjectInvitation | null;
  role?: Role | null;
  invitedByName?: string;
  canManage?: boolean;
  onResend?: () => void;
  resending?: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Raw tokens are never shown here (see AI_HANDOFF.md "Owner Experience":
 * "Hide raw invitation tokens") -- this surfaces a "Copy invite link"
 * action instead, and a real Resend button for pending/expired/revoked
 * invitations calling the same POST .../resend endpoint InvitationRow
 * uses. */
export function InvitationDetailsDialog({
  invitation,
  role,
  invitedByName,
  canManage,
  onResend,
  resending,
  onOpenChange,
}: InvitationDetailsDialogProps) {
  const { toast } = useNotifications();
  const canResend =
    canManage &&
    !!invitation &&
    (invitation.status === "pending" || invitation.status === "expired" || invitation.status === "revoked");

  return (
    <Dialog open={!!invitation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {invitation && (
          <>
            <DialogHeader>
              <DialogTitle>Invitation details</DialogTitle>
              <DialogDescription>{invitation.email}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="secondary"
                  className={`${INVITATION_STATUS_META[invitation.status].text} ${INVITATION_STATUS_META[invitation.status].color}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${INVITATION_STATUS_META[invitation.status].dot}`} />
                  {INVITATION_STATUS_META[invitation.status].label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Assigned role</span>
                <RoleBadge role={role} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Invited by</span>
                <span>{invitedByName ?? "Unknown"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(invitation.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expires</span>
                <span>{format(new Date(invitation.expires_at), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
              {invitation.accepted_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Accepted</span>
                  <span>{format(new Date(invitation.accepted_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
              {invitation.rejected_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rejected</span>
                  <span>{format(new Date(invitation.rejected_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
            </div>
            
            {canResend && (
              <>
                <Separator className="my-4" />
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Invite link</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-xs">
                        {window.location.origin}/invite/••••••••••
                      </code>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard?.writeText(`${window.location.origin}/invite/${invitation.token}`);
                          toast("Invite link copied", "success");
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  

                  <Button variant="outline" className="w-full" onClick={onResend} disabled={resending}>
                    <RotateCw className="h-4 w-4" /> {resending ? "Resending…" : "Resend invitation"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
