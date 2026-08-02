import { Lock, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/collaboration";

interface RoleBadgeProps {
  role?: Role | null;
  className?: string;
}

/** Renders a Role as a badge, with a lock icon for built-in system
 * roles (Owner/Admin/Member/Viewer -- see routers/roles.py's
 * `is_system` protection) and a crown for Owner specifically, so
 * "visual protection for built-in roles" is legible at a glance. */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (!role) {
    return (
      <Badge variant="secondary" className={className}>
        No role
      </Badge>
    );
  }
  const isOwner = role.name === "Owner";
  return (
    <Badge
      variant={isOwner ? "default" : "secondary"}
      className={cn(isOwner && "bg-primary/15 text-primary border-primary/30", className)}
    >
      {isOwner ? <Crown className="h-3 w-3" /> : role.is_system ? <Lock className="h-3 w-3" /> : null}
      {role.name}
    </Badge>
  );
}
