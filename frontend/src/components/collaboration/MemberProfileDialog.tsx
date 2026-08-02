import { format } from "date-fns";
import { Mail, Calendar, Clock, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoleBadge } from "./RoleBadge";
import { MEMBER_STATUS_META, initialsOf } from "@/lib/collaborationMeta";
import type { ProjectMemberWithUser } from "@/types/collaboration";

interface MemberProfileDialogProps {
  member: ProjectMemberWithUser | null;
  isOwner: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberProfileDialog({ member, isOwner, onOpenChange }: MemberProfileDialogProps) {
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {member && (
          <>
            <DialogHeader>
              <DialogTitle>Member profile</DialogTitle>
              <DialogDescription>Details for this project member.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-3 py-2">
              <Avatar className="h-16 w-16">
                <AvatarImage src={member.user?.avatar_url || undefined} alt="" />
                <AvatarFallback className="text-lg">{initialsOf(member.user?.display_name || member.user?.username || "?")}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-display text-base font-semibold flex items-center gap-1.5 justify-center">
                  {member.user?.display_name || member.user?.username || "Unknown user"}
                  {isOwner && <Shield className="h-3.5 w-3.5 text-primary" aria-label="Owner" />}
                </p>
                <p className="text-xs text-muted-foreground">@{member.user?.username ?? "unknown"}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <RoleBadge role={member.role} />
                <Badge
                  variant="secondary"
                  className={`${MEMBER_STATUS_META[member.status].text} ${MEMBER_STATUS_META[member.status].color}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${MEMBER_STATUS_META[member.status].dot}`} />
                  {MEMBER_STATUS_META[member.status].label}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2.5 pt-3 text-sm">
              {member.user?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.user.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Joined {format(new Date(member.joined_at), "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {member.last_active_at
                    ? `Last active ${format(new Date(member.last_active_at), "MMM d, yyyy 'at' h:mm a")}`
                    : "No activity recorded yet"}
                </span>
              </div>
              {member.permission_overrides.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Permission overrides</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.permission_overrides.map((key) => (
                      <Badge key={key} variant="outline" className="text-[10px]">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
