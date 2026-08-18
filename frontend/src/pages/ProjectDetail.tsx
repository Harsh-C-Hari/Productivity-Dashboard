import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ListChecks, Bug as BugIcon, Milestone as MilestoneIcon, Users, Crown, Globe, Lock, UserPlus, Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Badge } from "@/components/ui/badge";
import { RoadmapView } from "@/components/project-workspace/RoadmapView";
import { FeatureList } from "@/components/project-workspace/FeatureList";
import { TodoList } from "@/components/project-workspace/TodoList";
import { BugList } from "@/components/project-workspace/BugList";
import { MilestoneList } from "@/components/project-workspace/MilestoneList";
import { DocumentList } from "@/components/project-workspace/DocumentList";
import { ProjectResourceList } from "@/components/project-workspace/ProjectResourceList";
import { ProjectTimeline } from "@/components/project-workspace/ProjectTimeline";
import { ProjectAnalyticsView } from "@/components/project-workspace/ProjectAnalyticsView";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { ProjectIcon } from "@/components/project-workspace/ProjectIcon";
import { RoleBadge } from "@/components/collaboration/RoleBadge";
import { ProjectSettings } from "@/components/collaboration/ProjectSettings";
import { InviteMemberDialog } from "@/components/collaboration/InviteMemberDialog";
import { Button } from "@/components/ui/button";
import { useProject, useProjectSummary } from "@/hooks/useProjects";
import { useProjectCollaborationSummary, useCurrentMembership } from "@/hooks/useProjectMembers";
import { useUser } from "@/hooks/useUsers";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { PROJECT_STATUS_META } from "@/lib/projectMeta";
import { VISIBILITY_META, PROJECT_TYPE_META, collaborationAllowed } from "@/lib/collaborationMeta";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading, isError } = useProject(projectId);
  const { data: summary } = useProjectSummary(projectId);
  const { data: collabSummary } = useProjectCollaborationSummary(projectId);
  const { role: myRole, isOwner, hasPermission } = useCurrentMembership(projectId);
  const { data: owner } = useUser(project?.owner_id ?? undefined);
  const [quickInviteOpen, setQuickInviteOpen] = useState(false);

  if (isError) return <Navigate to="/projects" replace />;

  if (isLoading || !project) {
    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card h-24 animate-pulse bg-white/[0.02]" />
        <div className="glass-card h-96 animate-pulse bg-white/[0.02]" />
      </div>
    );
  }

  const colorClasses = SUBJECT_COLOR_CLASSES[project.color] ?? SUBJECT_COLOR_CLASSES.purple;
  const statusMeta = PROJECT_STATUS_META[project.status];
  const rate = summary?.overall_progress ?? project.progress;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col gap-5">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>

        <div className="glass-card p-5 flex items-center gap-4">
          <ProgressRing progress={rate} size={64} strokeWidth={5} color={subjectColorHex(project.color)}>
            <span className="font-mono text-xs font-semibold">{Math.round(rate)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ProjectIcon icon={project.icon} className={`h-4 w-4 shrink-0 ${colorClasses.text}`} />
              <h2 className="font-display text-lg font-semibold truncate">{project.name}</h2>
              <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
            </div>
            <p className="text-sm text-muted-foreground truncate">{project.description || "No description yet"}</p>
          </div>
          <div className="hidden sm:flex gap-4 text-center shrink-0">
            <div>
              <p className="font-mono text-lg font-semibold leading-none flex items-center justify-center gap-1">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                {summary ? `${summary.completed_todo_count}/${summary.todo_count}` : "–"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">todos</p>
            </div>
            <div>
              <p
                className={`font-mono text-lg font-semibold leading-none flex items-center justify-center gap-1 ${
                  (summary?.open_bug_count ?? 0) > 0 ? "text-urgency-critical" : ""
                }`}
              >
                <BugIcon className="h-3.5 w-3.5" />
                {summary?.open_bug_count ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">open bugs</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold leading-none flex items-center justify-center gap-1">
                <MilestoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {summary ? `${summary.completed_milestone_count}/${summary.milestone_count}` : "–"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">milestones</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {owner && (
            <Badge variant="outline" className="text-[11px]">
              <Crown className="h-3 w-3 text-primary" /> Owner: {owner.display_name || owner.username}
            </Badge>
          )}
          <Badge variant="outline" className="text-[11px]">
            <Users className="h-3 w-3" /> {collabSummary?.member_count ?? 0} member
            {collabSummary?.member_count === 1 ? "" : "s"}
          </Badge>
          {myRole && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              You:
              <RoleBadge role={myRole} />
            </span>
          )}
          <Badge variant="outline" className="text-[11px]">
            {project.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {VISIBILITY_META[project.visibility].label}
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            {PROJECT_TYPE_META[project.project_type]}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[11px] ${project.collaboration_enabled ? "text-urgency-low border-urgency-low/40" : ""}`}
          >
            Collaboration {project.collaboration_enabled ? "on" : "off"}
          </Badge>
          {collabSummary && collabSummary.pending_invitation_count > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {collabSummary.pending_invitation_count} pending invite
              {collabSummary.pending_invitation_count === 1 ? "" : "s"}
            </Badge>
          )}
          {collaborationAllowed(project) && hasPermission("invite_members") && (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setQuickInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Quick invite
            </Button>
          )}
        </div>
      </div>

      <InviteMemberDialog projectId={project.id} open={quickInviteOpen} onOpenChange={setQuickInviteOpen} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-3.5 w-3.5" /> Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <RoadmapView projectId={project.id} />
              <TodoList projectId={project.id} />
            </div>
            <div className="flex flex-col gap-4">
              <MilestoneList projectId={project.id} />
              <ProjectTimeline projectId={project.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roadmap">
          <RoadmapView projectId={project.id} />
        </TabsContent>

        <TabsContent value="features">
          <FeatureList projectId={project.id} />
        </TabsContent>

        <TabsContent value="todos">
          <TodoList projectId={project.id} />
        </TabsContent>

        <TabsContent value="bugs">
          <BugList projectId={project.id} />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestoneList projectId={project.id} />
        </TabsContent>

        <TabsContent value="documentation">
          <DocumentList projectId={project.id} />
        </TabsContent>

        <TabsContent value="resources">
          <ProjectResourceList projectId={project.id} />
        </TabsContent>

        <TabsContent value="timeline">
          <ProjectTimeline projectId={project.id} />
        </TabsContent>

        <TabsContent value="analytics">
          <ProjectAnalyticsView projectId={project.id} />
        </TabsContent>

        <TabsContent value="team">
          <ProjectSettings project={project} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
