import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignmentCard } from "@/components/study-hub/AssignmentCard";
import type { Assignment } from "@/types";
import { cn } from "@/lib/utils";

interface AssignmentWidgetCardProps {
  title: string;
  icon: ReactNode;
  assignments: Assignment[];
  emptyMessage: string;
  accentClassName?: string;
}

export function AssignmentWidgetCard({
  title,
  icon,
  assignments,
  emptyMessage,
  accentClassName,
}: AssignmentWidgetCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentClassName)}>{icon}</div>
          <CardTitle>{title}</CardTitle>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{assignments.length}</span>
      </CardHeader>
      <div className="flex flex-col gap-2 px-5 pb-5 max-h-[340px] overflow-y-auto scrollbar-thin">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        ) : (
          <AnimatePresence initial={false}>
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} compact />
            ))}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
