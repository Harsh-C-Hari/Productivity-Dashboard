import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, ListChecks, Bug as BugIcon, Milestone as MilestoneIcon, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BUG_SEVERITY_META, BUG_STATUS_META, FEATURE_STATUS_META } from "@/lib/projectMeta";
import { useProjectAnalytics } from "@/hooks/useProjectAnalytics";
import type { ProjectAnalytics as ProjectAnalyticsData } from "@/types";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono font-medium" style={{ color: p.color }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

export function ProjectAnalyticsView({ projectId }: { projectId: string }) {
  const { data: analytics, isLoading } = useProjectAnalytics(projectId);

  if (isLoading || !analytics) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Crunching numbers…</div>;
  }

  return <AnalyticsBody analytics={analytics} />;
}

function AnalyticsBody({ analytics }: { analytics: ProjectAnalyticsData }) {
  const velocityData = analytics.velocity.map((v) => ({
    label: format(parseISO(v.week_start), "MMM d"),
    todos: v.todos_completed,
    bugs: v.bugs_resolved,
    milestones: v.milestones_reached,
  }));

  const severityData = analytics.bugs_by_severity.map((s) => ({
    name: BUG_SEVERITY_META[s.severity].label,
    count: s.count,
    key: s.severity,
  }));

  const statusData = analytics.bugs_by_status.map((s) => ({
    name: BUG_STATUS_META[s.status].label,
    count: s.count,
    key: s.status,
  }));

  const featureStatusData = analytics.features_by_status.map((f) => ({
    name: FEATURE_STATUS_META[f.status].label,
    count: f.count,
    key: f.status,
  }));

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <TrendingUp className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Analytics</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            icon={ListChecks}
            label="Todos done"
            value={`${analytics.completed_todos}/${analytics.total_todos}`}
            color="text-primary"
          />
          <StatTile
            icon={BugIcon}
            label="Open bugs"
            value={`${analytics.open_bugs}`}
            color={analytics.open_bugs > 0 ? "text-urgency-critical" : "text-urgency-low"}
          />
          <StatTile
            icon={MilestoneIcon}
            label="Milestones"
            value={`${analytics.completed_milestones}/${analytics.total_milestones}`}
            color="text-secondary"
          />
          <StatTile icon={Layers} label="Features" value={`${analytics.total_features}`} color="text-urgency-medium" />
        </div>

        {velocityData.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Weekly velocity</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(217,167,91,0.3)" }} />
                  <Line type="monotone" dataKey="todos" name="todos" stroke="#D9A75B" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="bugs" name="bugs" stroke="#D9915A" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="milestones" name="milestones" stroke="#8FA98C" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {severityData.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Bugs by severity</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 11, fill: "#C9C6C0" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                      {severityData.map((entry) => (
                        <Cell key={entry.key} fill={colorForKey(entry.key)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {featureStatusData.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Features by status</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureStatusData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 11, fill: "#C9C6C0" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" fill="#D9A75B" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {statusData.length === 0 && severityData.length === 0 && featureStatusData.length === 0 && velocityData.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Not enough activity yet to chart — add features, todos, and bugs to see trends.
          </p>
        )}
      </div>
    </Card>
  );
}

function colorForKey(key: string): string {
  const map: Record<string, string> = { low: "#7FA872", medium: "#D9C15A", high: "#D9915A", critical: "#C1584A" };
  return map[key] ?? "#D9A75B";
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-base-900/40 p-3">
      <Icon className={`h-4 w-4 ${color} mb-2`} />
      <p className="font-mono text-lg font-semibold leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
