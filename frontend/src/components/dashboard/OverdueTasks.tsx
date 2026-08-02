import { AlertTriangle } from "lucide-react";
import { TaskWidgetCard } from "./TaskWidgetCard";
import type { Task } from "@/types";

export function OverdueTasks({ tasks }: { tasks: Task[] }) {
  return (
    <TaskWidgetCard
      title="Overdue"
      icon={<AlertTriangle className="h-4 w-4 text-urgency-critical" />}
      accentClassName="bg-urgency-critical/10"
      tasks={tasks}
      emptyMessage="Nothing overdue. You're on top of it."
    />
  );
}
