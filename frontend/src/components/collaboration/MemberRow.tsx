import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Crown, UserMinus, LogOut, ShieldQuestion, UserCheck, UserX } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "./RoleBadge";
import { MEMBER_STATUS_META, initialsOf } from "@/lib/collaborationMeta";
import type { ProjectMemberWithUser } from "@/types/collaboration";
import type { Role } from "@/types/collaboration";

interface MemberRowProps {
  member: ProjectMemberWithUser;
  isSelf: boolean;
  isTargetOwner: boolean;
  canManage: boolean;
  canTransferOwnership: boolean;
  assignableRoles: Role[];
  onViewProfile: () => void;
  onChangeRole: (roleId: string) => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
  onLeave: () => void;
  onTransferOwnership: () => void;
}

export function MemberRow({
  member,
  isSelf,
  isTargetOwner,
  canManage,
  canTransferOwnership,
  assignableRoles,
  onViewProfile,
  onChangeRole,
  onSuspend,
  onReactivate,
  onRemove,
  onLeave,
  onTransferOwnership,
}: MemberRowProps) {
  const statusMeta = MEMBER_STATUS_META[member.status];
  const name = member.user?.display_name || member.user?.username || "Unknown user";
  const hasActions = canManage || isSelf;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-base-900/30 p-3 hover:border-white/10 transition-colors">
      <button onClick={onViewProfile} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <Avatar>
          <AvatarImage src={member.user?.avatar_url || undefined} alt="" />
          <AvatarFallback>{initialsOf(name)}</AvatarFallback>
        </Avatar>
      </button>

      <button onClick={onViewProfile} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{name}</p>
          {isTargetOwner && <Crown className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Owner" />}
          {isSelf && (
            <Badge variant="outline" className="text-[10px] py-0">
              You
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.user?.email ?? member.user_id}</p>
      </button>

      <div className="hidden md:flex flex-col items-end gap-1 shrink-0 text-right">
        <RoleBadge role={member.role} />
        <p className="text-[11px] text-muted-foreground">
          {member.last_active_at
            ? `Active ${formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}`
            : `Joined ${formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}`}
        </p>
      </div>

      <Badge
        variant="secondary"
        className={`shrink-0 hidden sm:inline-flex ${statusMeta.text} ${statusMeta.color}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
        {statusMeta.label}
      </Badge>

      {hasActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Member actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Member</DropdownMenuLabel>
            <DropdownMenuItem onClick={onViewProfile}>
              <ShieldQuestion className="h-4 w-4" /> View profile
            </DropdownMenuItem>

            {canManage && !isTargetOwner && assignableRoles.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {assignableRoles.map((role) => (
                    <DropdownMenuItem key={role.id} onClick={() => onChangeRole(role.id)}>
                      <RoleBadge role={role} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {canManage && !isTargetOwner && (
              <>
                {member.status === "suspended" ? (
                  <DropdownMenuItem onClick={onReactivate}>
                    <UserCheck className="h-4 w-4" /> Reactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onSuspend}>
                    <UserX className="h-4 w-4" /> Suspend
                  </DropdownMenuItem>
                )}
              </>
            )}

            {canTransferOwnership && !isTargetOwner && member.status === "active" && (
              <DropdownMenuItem onClick={onTransferOwnership}>
                <Crown className="h-4 w-4" /> Make Owner
              </DropdownMenuItem>
            )}

            {(canManage || isSelf) && <DropdownMenuSeparator />}

            {isSelf ? (
              <DropdownMenuItem variant="destructive" onClick={onLeave}>
                <LogOut className="h-4 w-4" /> Leave project
              </DropdownMenuItem>
            ) : (
              canManage &&
              !isTargetOwner && (
                <DropdownMenuItem variant="destructive" onClick={onRemove}>
                  <UserMinus className="h-4 w-4" /> Remove from project
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="w-10 shrink-0" />
      )}
    </div>
  );
}
