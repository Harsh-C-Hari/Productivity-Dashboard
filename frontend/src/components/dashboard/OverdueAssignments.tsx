import { AlertTriangle } from "lucide-react";
import { AssignmentWidgetCard } from "./AssignmentWidgetCard";
import type { Assignment } from "@/types";

export function OverdueAssignments({ assignments }: { assignments: Assignment[] }) {
  return (
    <AssignmentWidgetCard
      title="Overdue Assignments"
      icon={<AlertTriangle className="h-4 w-4 text-urgency-critical" />}
      accentClassName="bg-urgency-critical/10"
      assignments={assignments}
      emptyMessage="Nothing overdue in Study Hub."
    />
  );
}
