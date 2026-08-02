import { formatDistanceToNow, isPast } from "date-fns";
import { Mail, MoreVertical, Link2, RotateCw, XCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "./RoleBadge";
import { INVITATION_STATUS_META } from "@/lib/collaborationMeta";
import { useNotifications } from "@/context/NotificationContext";
import type { Role } from "@/types/collaboration";
import type { ProjectInvitation } from "@/types/collaboration";

interface InvitationRowProps {
  invitation: ProjectInvitation;
  role?: Role | null;
  invitedByName?: string;
  canManage: boolean;
  onViewDetails: () => void;
  onCancel: () => void;
  onResend: () => void;
  resending?: boolean;
}

/** Owner-facing invitation row. Raw tokens are never shown here (see
 * AI_HANDOFF.md "Owner Experience": "Hide raw invitation tokens") --
 * "Copy invite link" copies the full /invite/{token} URL instead, and
 * "Resend" calls the real POST .../resend endpoint (no more "coming
 * soon" placeholder; see routers/project_invitations.py). Resend is
 * offered for pending, expired, and revoked invitations -- anything
 * the resend endpoint itself accepts -- since re-issuing a link is
 * exactly how you'd recover from any of those without SMTP. */
export function InvitationRow({
  invitation,
  role,
  invitedByName,
  canManage,
  onViewDetails,
  onCancel,
  onResend,
  resending,
}: InvitationRowProps) {
  const { toast } = useNotifications();
  const statusMeta = INVITATION_STATUS_META[invitation.status];
  const expiresSoon = invitation.status === "pending" && !isPast(new Date(invitation.expires_at));
  const canResend = invitation.status === "pending" || invitation.status === "expired" || invitation.status === "revoked";

  function copyInviteLink() {
    const url = `${window.location.origin}/invite/${invitation.token}`;
    navigator.clipboard?.writeText(url);
    toast("Invite link copied", "success");
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-base-900/30 p-3 hover:border-white/10 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
        <Mail className="h-4 w-4" />
      </div>

      <button onClick={onViewDetails} className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium truncate">{invitation.email}</p>
        <p className="text-xs text-muted-foreground truncate">
          {invitedByName ? `Invited by ${invitedByName}` : "Invited"} ·{" "}
          {invitation.status === "pending"
            ? expiresSoon
              ? `expires ${formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}`
              : "expired"
            : formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
        </p>
      </button>

      <div className="hidden md:block shrink-0">
        <RoleBadge role={role} />
      </div>

      <Badge variant="secondary" className={`shrink-0 ${statusMeta.text} ${statusMeta.color}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
        {statusMeta.label}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Invitation actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onViewDetails}>
            <Info className="h-4 w-4" /> View details
          </DropdownMenuItem>
          {invitation.status === "pending" && expiresSoon && (
            <DropdownMenuItem onClick={copyInviteLink}>
              <Link2 className="h-4 w-4" /> Copy invite link
            </DropdownMenuItem>
          )}
          {canManage && canResend && (
            <>
              <DropdownMenuItem onClick={onResend} disabled={resending}>
                <RotateCw className="h-4 w-4" /> {resending ? "Resending…" : "Resend invitation"}
              </DropdownMenuItem>
              {invitation.status === "pending" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onCancel}>
                    <XCircle className="h-4 w-4" /> Cancel invitation
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
