import { formatDistanceToNowStrict, isPast, format, isToday, isTomorrow } from "date-fns";

export function formatDeadline(iso: string | null): string {
  if (!iso) return "No deadline";
  const date = new Date(iso);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "h:mm a")}`;
  return format(date, "EEE MMM d, h:mm a");
}

export function formatCountdown(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const overdue = isPast(date);
  const distance = formatDistanceToNowStrict(date);
  return overdue ? `${distance} overdue` : `in ${distance}`;
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return isPast(new Date(iso));
}
