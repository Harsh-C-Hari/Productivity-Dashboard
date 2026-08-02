import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ListTodo, CheckCircle2, AlarmClock, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { QuickStats as QuickStatsType } from "@/types";

const STAT_ITEMS = (stats: QuickStatsType) => [
  { label: "Total tasks", value: stats.total_tasks, icon: ListTodo, color: "text-secondary", ring: "bg-secondary/10" },
  { label: "Completed", value: stats.completed_tasks, icon: CheckCircle2, color: "text-urgency-low", ring: "bg-urgency-low/10" },
  { label: "Overdue", value: stats.overdue_tasks, icon: AlarmClock, color: "text-urgency-critical", ring: "bg-urgency-critical/10" },
  { label: "Due today", value: stats.due_today, icon: CalendarCheck, color: "text-primary", ring: "bg-primary/10" },
];

export function QuickStatsPanel({ stats }: { stats: QuickStatsType }) {
  const donutData = [
    { name: "done", value: stats.completion_rate },
    { name: "remaining", value: 100 - stats.completion_rate },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display text-base font-semibold">Quick Stats</p>
          <p className="text-xs text-muted-foreground">Where things stand right now</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 rounded-xl border border-white/10 bg-base-900/40 p-3">
          <div className="relative h-14 w-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={20}
                  outerRadius={27}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  <Cell fill="#D9A75B" />
                  <Cell fill="rgba(255,255,255,0.06)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[10px] font-semibold">{stats.completion_rate}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-sm font-medium">rate this term</p>
          </div>
        </div>

        {STAT_ITEMS(stats).map(({ label, value, icon: Icon, color, ring }) => (
          <div key={label} className="flex flex-col justify-between rounded-xl border border-white/10 bg-base-900/40 p-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ring} ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="mt-2">
              <p className="font-mono text-xl font-semibold leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
