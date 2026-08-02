import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { titleCase } from "@/lib/collaborationMeta";
import type { Permission } from "@/types/collaboration";

interface PermissionViewerProps {
  permissions: Permission[];
  /** Selected permission keys. Omit for pure read-only display. */
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  readOnly?: boolean;
}

/** Groups permissions by `category` into labelled "Permission Groups"
 * and renders each as a checkbox (editable) or a plain badge-like row
 * (read-only) -- shared between RoleFormDialog's permission picker and
 * the standalone Permissions settings tab. */
export function PermissionViewer({ permissions, selected, onToggle, readOnly }: PermissionViewerProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">No permissions in the catalog yet.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([category, perms]) => (
        <div key={category}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {titleCase(category)}
          </p>
          <div className="flex flex-col gap-2">
            {perms.map((permission) => (
              <label
                key={permission.id}
                className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-base-900/30 p-2.5 text-sm data-[readonly=true]:cursor-default cursor-pointer hover:border-white/10"
                data-readonly={readOnly}
              >
                {!readOnly && (
                  <Checkbox
                    checked={selected?.has(permission.key) ?? false}
                    onChange={() => onToggle?.(permission.key)}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium">{permission.name}</p>
                  {permission.description && (
                    <p className="text-xs text-muted-foreground">{permission.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
