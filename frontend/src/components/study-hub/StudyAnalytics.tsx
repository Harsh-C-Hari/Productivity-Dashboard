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
import { Flame, Trophy, Clock, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { subjectColorHex } from "@/lib/subjectColors";
import type { StudyAnalytics as StudyAnalyticsData } from "@/types";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-mono font-medium">{payload[0].value} {payload[0].unit ?? ""}</p>
    </div>
  );
}

export function StudyAnalytics({ analytics }: { analytics: StudyAnalyticsData }) {
  const dailyData = analytics.daily_minutes_last_14_days.map((d) => ({
    label: format(parseISO(d.date), "EEE"),
    minutes: d.minutes,
  }));

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <TrendingUp className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Study Analytics</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={Flame} label="Current streak" value={`${analytics.current_streak_days}d`} color="text-urgency-high" />
          <StatTile icon={Trophy} label="Longest streak" value={`${analytics.longest_streak_days}d`} color="text-urgency-medium" />
          <StatTile icon={Clock} label="This week" value={`${analytics.total_hours_this_week}h`} color="text-secondary" />
          <StatTile icon={Clock} label="All time" value={`${analytics.total_hours_all_time}h`} color="text-primary" />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Last 14 days</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(217,167,91,0.3)" }} />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="#D9A75B"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#D9A75B" }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {analytics.hours_by_subject.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Hours by subject</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.hours_by_subject}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="subject_name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 11, fill: "#C9C6C0" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="hours" radius={[0, 6, 6, 0]} barSize={14}>
                    {analytics.hours_by_subject.map((entry) => (
                      <Cell key={entry.subject_id} fill={subjectColorHex(entry.subject_color)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Flame;
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
