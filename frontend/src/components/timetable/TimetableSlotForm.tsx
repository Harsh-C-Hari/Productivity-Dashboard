import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DayOfWeek, TimetableSlot, TimetableSlotInput } from "@/types";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

const COLORS = [
  { value: "purple", dot: "bg-primary" },
  { value: "blue", dot: "bg-secondary" },
  { value: "cyan", dot: "bg-accent" },
  { value: "pink", dot: "bg-[#C98FA0]" },
  { value: "green", dot: "bg-urgency-low" },
  { value: "orange", dot: "bg-urgency-high" },
];

interface TimetableSlotFormProps {
  initial?: TimetableSlot;
  defaultDay?: DayOfWeek;
  onSubmit: (payload: TimetableSlotInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function TimetableSlotForm({
  initial,
  defaultDay,
  onSubmit,
  onCancel,
  submitting,
}: TimetableSlotFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [day, setDay] = useState<DayOfWeek>(initial?.day_of_week ?? defaultDay ?? "mon");
  const [start, setStart] = useState(initial?.start_time ?? "09:00");
  const [end, setEnd] = useState(initial?.end_time ?? "10:00");
  const [color, setColor] = useState(initial?.color ?? "purple");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (end <= start) {
      setError("End time must be after start time");
      return;
    }
    setError("");
    onSubmit({ title: title.trim(), location: location.trim(), day_of_week: day, start_time: start, end_time: end, color });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-title">Title</Label>
        <Input id="slot-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Structures Lecture" required autoFocus />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-location">Location</Label>
        <Input id="slot-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hall B12" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Day</Label>
        <Select value={day} onValueChange={(v) => setDay(v as DayOfWeek)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-start">Start time</Label>
          <Input id="slot-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-end">End time</Label>
          <Input id="slot-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      {error && <p className="text-xs text-urgency-critical">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <Label>Color tag</Label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-transform",
                color === c.value ? "border-white scale-110" : "border-transparent"
              )}
              aria-label={`Color ${c.value}`}
            >
              <span className={cn("h-4 w-4 rounded-full", c.dot)} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !title.trim()}>
          {initial ? "Save changes" : "Add to timetable"}
        </Button>
      </div>
    </form>
  );
}
