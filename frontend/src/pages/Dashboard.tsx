import { motion } from "framer-motion";
import { useDashboard } from "@/hooks/useDashboard";
import { QuickStatsPanel } from "@/components/dashboard/QuickStats";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { OverdueTasks } from "@/components/dashboard/OverdueTasks";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SubjectsProgressWidget } from "@/components/dashboard/SubjectsProgressWidget";
import { UpcomingAssignments } from "@/components/dashboard/UpcomingAssignments";
import { OverdueAssignments } from "@/components/dashboard/OverdueAssignments";
import { TodayStudySessions } from "@/components/dashboard/TodayStudySessions";
import { CurrentProjectWidget } from "@/components/dashboard/CurrentProjectWidget";
import { CurrentPhaseWidget } from "@/components/dashboard/CurrentPhaseWidget";
import { UpcomingMilestonesWidget } from "@/components/dashboard/UpcomingMilestonesWidget";
import { OpenBugsWidget } from "@/components/dashboard/OpenBugsWidget";
import { ProjectsProgressWidget } from "@/components/dashboard/ProjectsProgressWidget";
import { ProjectTimelineWidget } from "@/components/dashboard/ProjectTimelineWidget";
import { AIWorkspaceWidget } from "@/components/dashboard/AIWorkspaceWidget";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";

export default function Dashboard() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass-card h-72 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="font-display text-lg font-semibold mb-1">Couldn't load your dashboard</p>
        <p className="text-sm text-muted-foreground">
          Make sure the backend is running at the expected API URL, then refresh.
        </p>
      </div>
    );
  }

  const hasStudyHubData =
    data.subjects_progress.length > 0 ||
    data.upcoming_assignments.length > 0 ||
    data.overdue_assignments.length > 0 ||
    data.today_study_sessions.length > 0;

  const hasProjectData =
    data.projects_progress.length > 0 ||
    data.upcoming_milestones.length > 0 ||
    data.overdue_project_todos.length > 0 ||
    data.recent_project_timeline.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4"
    >
      <QuickStatsPanel stats={data.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TodayTasks tasks={data.today_tasks} />
        <OverdueTasks tasks={data.overdue_tasks} />
        <UpcomingDeadlines tasks={data.upcoming_deadlines} />
      </div>

      {hasStudyHubData && (
        <>
          <SubjectsProgressWidget subjects={data.subjects_progress} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <UpcomingAssignments assignments={data.upcoming_assignments} />
            <OverdueAssignments assignments={data.overdue_assignments} />
            <TodayStudySessions sessions={data.today_study_sessions} />
          </div>
        </>
      )}

      {hasProjectData && (
        <>
          <ProjectsProgressWidget projects={data.projects_progress} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CurrentProjectWidget projects={data.projects_progress} />
            <CurrentPhaseWidget projects={data.projects_progress} />
            <UpcomingMilestonesWidget milestones={data.upcoming_milestones} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OpenBugsWidget />
            <ProjectTimelineWidget events={data.recent_project_timeline} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NotificationsWidget />
        <AIWorkspaceWidget />
      </div>

      <RecentActivity entries={data.recent_activity} />
    </motion.div>
  );
}

