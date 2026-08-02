import { Lock, Crown, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/types/collaboration";

interface RoleCardProps {
  role: Role;
  memberCount: number;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RoleCard({ role, memberCount, canManage, onView, onEdit, onDelete }: RoleCardProps) {
  const isOwnerRole = role.name === "Owner";

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isOwnerRole ? (
            <Crown className="h-4 w-4 text-primary shrink-0" />
          ) : role.is_system ? (
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : null}
          <p className="font-display font-semibold truncate">{role.name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Role actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4" /> View permissions
            </DropdownMenuItem>
            {canManage && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> {role.is_system ? "Edit description" : "Edit role"}
              </DropdownMenuItem>
            )}
            {canManage && !role.is_system && (
              <DropdownMenuItem variant="destructive" onClick={onDelete} disabled={memberCount > 0}>
                <Trash2 className="h-4 w-4" /> Delete role
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
        {role.description || "No description"}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[11px]">
          {role.permission_keys.length} permission{role.permission_keys.length === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </Badge>
        {role.is_system && (
          <Badge variant="secondary" className="text-[11px]">
            Built-in
          </Badge>
        )}
      </div>
    </Card>
  );
}
