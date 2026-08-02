import { Sun } from "lucide-react";
import { TaskWidgetCard } from "./TaskWidgetCard";
import type { Task } from "@/types";

export function TodayTasks({ tasks }: { tasks: Task[] }) {
  return (
    <TaskWidgetCard
      title="Today's Tasks"
      icon={<Sun className="h-4 w-4 text-primary" />}
      accentClassName="bg-primary/10"
      tasks={tasks}
      emptyMessage="Nothing due today. Enjoy the breathing room."
    />
  );
}
