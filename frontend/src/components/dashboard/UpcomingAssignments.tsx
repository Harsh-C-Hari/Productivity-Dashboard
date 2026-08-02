import { GraduationCap } from "lucide-react";
import { AssignmentWidgetCard } from "./AssignmentWidgetCard";
import type { Assignment } from "@/types";

export function UpcomingAssignments({ assignments }: { assignments: Assignment[] }) {
  return (
    <AssignmentWidgetCard
      title="Upcoming Assignments"
      icon={<GraduationCap className="h-4 w-4 text-primary" />}
      accentClassName="bg-primary/10"
      assignments={assignments}
      emptyMessage="No assignments due this week."
    />
  );
}
