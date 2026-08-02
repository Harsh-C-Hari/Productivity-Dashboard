import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MemberList } from "./MemberList";
import { InvitationList } from "./InvitationList";
import { RoleList } from "./RoleList";
import { PermissionsPanel } from "./PermissionsPanel";
import { ProjectSettingsGeneral } from "./ProjectSettingsGeneral";
import { ProjectSettingsDangerZone } from "./ProjectSettingsDangerZone";
import { useCurrentMembership } from "@/hooks/useProjectMembers";
import type { Project } from "@/types";

interface ProjectSettingsProps {
  project: Project;
}

/** "Project Settings" section from the frontend collaboration brief --
 * a single tabbed surface hosting General project settings alongside
 * the full Member/Invitation/Role/Permission management interfaces, so
 * there's one place for "everything about how this project is run."
 * Each nested tab is also independently reusable (e.g. MemberList is
 * what a future "Team" summary card could embed directly). */
export function ProjectSettings({ project }: ProjectSettingsProps) {
  const { isOwner, isAdmin } = useCurrentMembership(project.id);
  const canManage = isOwner || isAdmin;

  return (
    <Tabs defaultValue="general">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="invitations">Invitations</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="permissions">Permissions</TabsTrigger>
        <TabsTrigger value="danger" className="data-[state=active]:!bg-urgency-critical">
          Danger Zone
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <ProjectSettingsGeneral project={project} canManage={canManage} />
      </TabsContent>
      <TabsContent value="members">
        <MemberList projectId={project.id} />
      </TabsContent>
      <TabsContent value="invitations">
        <InvitationList projectId={project.id} />
      </TabsContent>
      <TabsContent value="roles">
        <RoleList projectId={project.id} />
      </TabsContent>
      <TabsContent value="permissions">
        <PermissionsPanel projectId={project.id} />
      </TabsContent>
      <TabsContent value="danger">
        <ProjectSettingsDangerZone project={project} isOwner={isOwner} />
      </TabsContent>
    </Tabs>
  );
}
