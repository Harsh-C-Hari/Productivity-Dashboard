import { useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MemberRow } from "./MemberRow";
import { MemberProfileDialog } from "./MemberProfileDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  useProjectMembers,
  useUpdateProjectMember,
  useRemoveProjectMember,
  useLeaveProject,
  useCurrentMembership,
} from "@/hooks/useProjectMembers";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/hooks/useProjects";
import { MEMBER_STATUS_OPTIONS, collaborationAllowed } from "@/lib/collaborationMeta";
import type { MemberStatus, ProjectMemberWithUser } from "@/types/collaboration";

const PAGE_SIZE = 10;

interface MemberListProps {
  projectId: string;
  onInviteRequested?: () => void;
}

export function MemberList({ projectId }: MemberListProps) {
  const { user } = useAuth();
  const { data: project } = useProject(projectId);
  const { data: members, isLoading, isError } = useProjectMembers(projectId);
  const { data: roles } = useRoles({ projectId, includeGlobal: true });
  const { data: users } = useUsers({ limit: 200 });
  const { isOwner, isAdmin, hasPermission } = useCurrentMembership(projectId);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileMember, setProfileMember] = useState<ProjectMemberWithUser | null>(null);
  const [transferTarget, setTransferTarget] = useState<ProjectMemberWithUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProjectMemberWithUser | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<ProjectMemberWithUser | null>(null);

  const updateMember = useUpdateProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const leaveProject = useLeaveProject(projectId);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const roleMap = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r])), [roles]);

  const enriched: ProjectMemberWithUser[] = useMemo(
    () =>
      (members ?? []).map((m) => ({
        ...m,
        user: userMap.get(m.user_id),
        role: m.role_id ? roleMap.get(m.role_id) ?? null : null,
      })),
    [members, userMap, roleMap]
  );

  const filtered = enriched.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (roleFilter !== "all" && m.role_id !== roleFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const name = (m.user?.display_name || m.user?.username || "").toLowerCase();
      const email = (m.user?.email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canManage = isAdmin || hasPermission("manage_members");
  const canInvite = canManage && !!project && collaborationAllowed(project);
  const assignableRoles = (roles ?? []).filter((r) => r.name !== "Owner");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card h-16 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Couldn't load members. Try refreshing the page.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search members..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as MemberStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {MEMBER_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(roles ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canInvite && (
            <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No members match your filters</p>
          <p className="text-xs text-muted-foreground">Try clearing search or filters, or invite someone new.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {paged.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.user_id === user?.id}
              isTargetOwner={!!project && project.owner_id === member.user_id}
              canManage={canManage}
              canTransferOwnership={isOwner}
              assignableRoles={assignableRoles}
              onViewProfile={() => setProfileMember(member)}
              onChangeRole={(roleId) => updateMember.mutate({ memberId: member.id, payload: { role_id: roleId } })}
              onSuspend={() => updateMember.mutate({ memberId: member.id, payload: { status: "suspended" } })}
              onReactivate={() => updateMember.mutate({ memberId: member.id, payload: { status: "active" } })}
              onRemove={() => setRemoveTarget(member)}
              onLeave={() => setLeaveTarget(member)}
              onTransferOwnership={() => setTransferTarget(member)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />
      <MemberProfileDialog
        member={profileMember}
        isOwner={!!project && !!profileMember && project.owner_id === profileMember.user_id}
        onOpenChange={(open) => !open && setProfileMember(null)}
      />
      <TransferOwnershipDialog
        projectId={projectId}
        target={transferTarget}
        onOpenChange={(open) => !open && setTransferTarget(null)}
      />
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member?"
        description={`${
          removeTarget?.user?.display_name || removeTarget?.user?.username || "This member"
        } will lose access to this project immediately. They can be re-invited later.`}
        confirmLabel="Remove"
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          removeMember.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) });
        }}
      />
      <ConfirmDialog
        open={!!leaveTarget}
        onOpenChange={(open) => !open && setLeaveTarget(null)}
        title="Leave this project?"
        description="You'll lose access to this project immediately. An Admin or Owner can invite you back later."
        confirmLabel="Leave project"
        loading={leaveProject.isPending}
        onConfirm={() => {
          if (!leaveTarget || !user) return;
          leaveProject.mutate(user.id, { onSuccess: () => setLeaveTarget(null) });
        }}
      />
    </div>
  );
}
