import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PermissionViewer } from "./PermissionViewer";
import { PermissionMatrix } from "./PermissionMatrix";
import { usePermissions } from "@/hooks/usePermissions";
import { useRoles } from "@/hooks/useRoles";

interface PermissionsPanelProps {
  projectId: string;
}

export function PermissionsPanel({ projectId }: PermissionsPanelProps) {
  const { data: permissions, isLoading } = usePermissions();
  const { data: roles } = useRoles({ projectId, includeGlobal: true });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card h-14 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="matrix">
      <TabsList>
        <TabsTrigger value="matrix">Role Matrix</TabsTrigger>
        <TabsTrigger value="catalog">Permission Catalog</TabsTrigger>
      </TabsList>
      <TabsContent value="matrix">
        <PermissionMatrix roles={roles ?? []} permissions={permissions ?? []} />
      </TabsContent>
      <TabsContent value="catalog">
        <PermissionViewer permissions={permissions ?? []} readOnly />
      </TabsContent>
    </Tabs>
  );
}
