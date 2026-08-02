import { useMemo, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvitationRow } from "./InvitationRow";
import { InvitationDetailsDialog } from "./InvitationDetailsDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { useProjectInvitations, useCancelProjectInvitation, useResendProjectInvitation } from "@/hooks/useProjectInvitations";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useCurrentMembership } from "@/hooks/useProjectMembers";
import type { InvitationStatus, ProjectInvitation } from "@/types/collaboration";

const TABS: { value: InvitationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Cancelled" },
];

interface InvitationListProps {
  projectId: string;
}

export function InvitationList({ projectId }: InvitationListProps) {
  const [tab, setTab] = useState<InvitationStatus | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<ProjectInvitation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ProjectInvitation | null>(null);

  const { data: invitations, isLoading, isError } = useProjectInvitations(projectId);
  const { data: roles } = useRoles({ projectId, includeGlobal: true });
  const { data: users } = useUsers({ limit: 200 });
  const { isAdmin, hasPermission } = useCurrentMembership(projectId);
  const cancelInvitation = useCancelProjectInvitation(projectId);
  const resendInvitation = useResendProjectInvitation(projectId);

  const canManage = isAdmin || hasPermission("invite_members");
  const roleMap = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r])), [roles]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const filtered = (invitations ?? []).filter((i) => tab === "all" || i.status === tab);
  const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function nameFor(userId: string | null) {
    if (!userId) return undefined;
    const u = userMap.get(userId);
    return u?.display_name || u?.username;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card h-16 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Couldn't load invitations. Try refreshing the page.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as InvitationStatus | "all")}>
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No invitations here</p>
          <p className="text-xs text-muted-foreground">
            {tab === "all" ? "Invite someone to get this project's team started." : `No ${tab} invitations.`}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              role={invitation.role_id ? roleMap.get(invitation.role_id) : undefined}
              invitedByName={nameFor(invitation.invited_by_user_id)}
              canManage={canManage}
              onViewDetails={() => setDetailsTarget(invitation)}
              onCancel={() => setCancelTarget(invitation)}
              onResend={() => resendInvitation.mutate(invitation.id)}
              resending={resendInvitation.isPending}
            />
          ))}
        </div>
      )}

      <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />
      <InvitationDetailsDialog
        invitation={detailsTarget}
        role={detailsTarget?.role_id ? roleMap.get(detailsTarget.role_id) : undefined}
        invitedByName={nameFor(detailsTarget?.invited_by_user_id ?? null)}
        canManage={canManage}
        onResend={() => detailsTarget && resendInvitation.mutate(detailsTarget.id)}
        resending={resendInvitation.isPending}
        onOpenChange={(open) => !open && setDetailsTarget(null)}
      />
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel invitation?"
        description={`The invitation to ${cancelTarget?.email} will no longer be usable.`}
        confirmLabel="Cancel invitation"
        loading={cancelInvitation.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancelInvitation.mutate(cancelTarget.id, { onSuccess: () => setCancelTarget(null) });
        }}
      />
    </div>
  );
}
