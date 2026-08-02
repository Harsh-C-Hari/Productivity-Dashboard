import { CalendarRange } from "lucide-react";
import { TaskWidgetCard } from "./TaskWidgetCard";
import type { Task } from "@/types";

export function UpcomingDeadlines({ tasks }: { tasks: Task[] }) {
  return (
    <TaskWidgetCard
      title="Upcoming Deadlines"
      icon={<CalendarRange className="h-4 w-4 text-secondary" />}
      accentClassName="bg-secondary/10"
      tasks={tasks}
      emptyMessage="Nothing on the horizon this week yet."
    />
  );
}
