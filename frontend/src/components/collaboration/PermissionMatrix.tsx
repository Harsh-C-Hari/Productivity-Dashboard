import { Check } from "lucide-react";
import { Fragment } from "react";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "./RoleBadge";
import { titleCase } from "@/lib/collaborationMeta";
import type { Permission, Role } from "@/types/collaboration";

interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
}

/** Read-only Role x Permission grid -- lets an Admin/Owner see, at a
 * glance, which roles grant which permissions without opening each
 * role individually. Purely a visualization: assigning/revoking still
 * happens through RoleFormDialog against the backend. */
export function PermissionMatrix({ roles, permissions }: PermissionMatrixProps) {
  const categories = [...new Set(permissions.map((p) => p.category))].sort();

  if (roles.length === 0 || permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to show yet.</p>;
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="sticky left-0 bg-base-900/80 px-4 py-3 text-left font-medium text-muted-foreground min-w-[200px]">
              Permission
            </th>
            {roles.map((role) => (
              <th key={role.id} className="px-3 py-3 text-center font-medium min-w-[110px]">
                <RoleBadge role={role} className="mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <Fragment key={category}>
              <tr className="bg-white/[0.02]">
                <td colSpan={roles.length + 1} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {titleCase(category)}
                </td>
              </tr>
              {permissions
                .filter((p) => p.category === category)
                .map((permission) => (
                  <tr key={permission.id} className="border-b border-white/5 last:border-0">
                    <td className="sticky left-0 bg-base-900/60 px-4 py-2.5">
                      <p className="font-medium">{permission.name}</p>
                      <p className="text-xs text-muted-foreground">{permission.key}</p>
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-3 py-2.5 text-center">
                        {role.permission_keys.includes(permission.key) && (
                          <Check className="h-4 w-4 text-urgency-low mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
