import { useMemo, useState } from "react";
import { Plus, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleCard } from "./RoleCard";
import { RoleFormDialog } from "./RoleFormDialog";
import { RoleDetailsDialog } from "./RoleDetailsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { useRoles, useDeleteRole } from "@/hooks/useRoles";
import { usePermissions } from "@/hooks/usePermissions";
import { useProjectMembers, useCurrentMembership } from "@/hooks/useProjectMembers";
import type { Role } from "@/types/collaboration";

interface RoleListProps {
  projectId: string;
}

export function RoleList({ projectId }: RoleListProps) {
  const { data: roles, isLoading, isError } = useRoles({ projectId, includeGlobal: true });
  const { data: permissions } = usePermissions();
  const { data: members } = useProjectMembers(projectId);
  const { isAdmin, hasPermission } = useCurrentMembership(projectId);
  const deleteRole = useDeleteRole();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [viewTarget, setViewTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const canManage = isAdmin || hasPermission("manage_roles");
  const memberCountByRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members ?? []) {
      if (!m.role_id) continue;
      map.set(m.role_id, (map.get(m.role_id) ?? 0) + 1);
    }
    return map;
  }, [members]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card h-32 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Couldn't load roles. Try refreshing the page.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Built-in roles (Owner, Admin, Member, Viewer) can't be renamed or have permissions changed.
        </p>
        {canManage && (
          <Button className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New role
          </Button>
        )}
      </div>

      {(roles ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <ShieldQuestion className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No roles yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(roles ?? []).map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              memberCount={memberCountByRole.get(role.id) ?? 0}
              canManage={canManage}
              onView={() => setViewTarget(role)}
              onEdit={() => setEditTarget(role)}
              onDelete={() => setDeleteTarget(role)}
            />
          ))}
        </div>
      )}

      <RoleFormDialog projectId={projectId} open={formOpen} onOpenChange={setFormOpen} />
      <RoleFormDialog
        projectId={projectId}
        role={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
      <RoleDetailsDialog
        role={viewTarget}
        permissions={permissions ?? []}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete role?"
        description={`"${deleteTarget?.name}" will be deleted permanently. This is only possible while no members hold this role.`}
        confirmLabel="Delete role"
        loading={deleteRole.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRole.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
