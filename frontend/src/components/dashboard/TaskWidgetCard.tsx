import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

interface TaskWidgetCardProps {
  title: string;
  icon: ReactNode;
  tasks: Task[];
  emptyMessage: string;
  accentClassName?: string;
  count?: number;
}

export function TaskWidgetCard({
  title,
  icon,
  tasks,
  emptyMessage,
  accentClassName,
  count,
}: TaskWidgetCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentClassName)}>
            {icon}
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{count ?? tasks.length}</span>
      </CardHeader>
      <div className="flex flex-col gap-2 px-5 pb-5 max-h-[340px] overflow-y-auto scrollbar-thin">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        ) : (
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} compact />
            ))}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
