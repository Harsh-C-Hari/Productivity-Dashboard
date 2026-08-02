import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PermissionViewer } from "./PermissionViewer";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateRole, useUpdateRole } from "@/hooks/useRoles";
import type { Role } from "@/types/collaboration";

interface RoleFormDialogProps {
  projectId: string;
  role?: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleFormDialog({ projectId, role, open, onOpenChange }: RoleFormDialogProps) {
  const isEdit = !!role;
  const isSystem = !!role?.is_system;
  const { data: permissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissionKeys, setPermissionKeys] = useState<Set<string>>(new Set(role?.permission_keys ?? []));

  function reset() {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissionKeys(new Set(role?.permission_keys ?? []));
  }

  function togglePermission(key: string) {
    setPermissionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEdit && role) {
      updateRole.mutate(
        {
          id: role.id,
          payload: isSystem
            ? { description: description.trim() }
            : { name: name.trim(), description: description.trim(), permission_keys: [...permissionKeys] },
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createRole.mutate(
        {
          name: name.trim(),
          description: description.trim(),
          project_id: projectId,
          permission_keys: [...permissionKeys],
        },
        {
          onSuccess: () => {
            reset();
            onOpenChange(false);
          },
        }
      );
    }
  }

  const submitting = createRole.isPending || updateRole.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSystem && <Lock className="h-4 w-4 text-muted-foreground" />}
            {isEdit ? `Edit role${isSystem ? " (built-in)" : ""}` : "Create role"}
          </DialogTitle>
          <DialogDescription>
            {isSystem
              ? "Built-in roles keep their name and permission set. You can still adjust the description."
              : "Custom roles can be assigned to any member of this project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Reviewer"
                disabled={isSystem}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What can this role do?"
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block">Permissions {isSystem && <span className="text-xs text-muted-foreground">(locked for built-in roles)</span>}</Label>
            <PermissionViewer
              permissions={permissions ?? []}
              selected={permissionKeys}
              onToggle={togglePermission}
              readOnly={isSystem}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
