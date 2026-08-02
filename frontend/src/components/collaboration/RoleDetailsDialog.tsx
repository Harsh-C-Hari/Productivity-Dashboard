import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PermissionViewer } from "./PermissionViewer";
import type { Permission, Role } from "@/types/collaboration";

interface RoleDetailsDialogProps {
  role: Role | null;
  permissions: Permission[];
  onOpenChange: (open: boolean) => void;
}

export function RoleDetailsDialog({ role, permissions, onOpenChange }: RoleDetailsDialogProps) {
  const granted = permissions.filter((p) => role?.permission_keys.includes(p.key));

  return (
    <Dialog open={!!role} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {role && (
          <>
            <DialogHeader>
              <DialogTitle>{role.name}</DialogTitle>
              <DialogDescription>{role.description || "No description"}</DialogDescription>
            </DialogHeader>
            {granted.length === 0 ? (
              <p className="text-sm text-muted-foreground">This role has no permissions assigned.</p>
            ) : (
              <PermissionViewer permissions={granted} readOnly />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
