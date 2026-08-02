import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimetableCard } from "@/components/timetable/TimetableCard";
import { TimetableSlotForm } from "@/components/timetable/TimetableSlotForm";
import { useCreateSlot, useTimetable } from "@/hooks/useTimetable";
import type { DayOfWeek, TimetableSlotInput } from "@/types";

const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "mon", label: "Monday", short: "Mon" },
  { value: "tue", label: "Tuesday", short: "Tue" },
  { value: "wed", label: "Wednesday", short: "Wed" },
  { value: "thu", label: "Thursday", short: "Thu" },
  { value: "fri", label: "Friday", short: "Fri" },
  { value: "sat", label: "Saturday", short: "Sat" },
  { value: "sun", label: "Sunday", short: "Sun" },
];

const TODAY_INDEX = (() => {
  // JS getDay(): 0=Sun..6=Sat -> map to our mon-first index
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
})();

export function WeeklyTimetable() {
  const { data: slots, isLoading } = useTimetable();
  const createSlot = useCreateSlot();
  const [addDialogDay, setAddDialogDay] = useState<DayOfWeek | null>(null);

  const byDay = useMemo(() => {
    const map: Record<DayOfWeek, typeof slots> = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } as any;
    (slots ?? []).forEach((slot) => {
      map[slot.day_of_week] = [...(map[slot.day_of_week] ?? []), slot];
    });
    for (const day of Object.keys(map) as DayOfWeek[]) {
      map[day]!.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [slots]);

  function handleCreate(payload: TimetableSlotInput) {
    createSlot.mutate(payload, { onSuccess: () => setAddDialogDay(null) });
  }

  if (isLoading) {
    return (
      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
        <div className="grid grid-cols-[repeat(7,minmax(168px,1fr))] lg:grid-cols-7 gap-3 min-w-[1176px] lg:min-w-0">
          {DAYS.map((d) => (
            <div key={d.value} className="glass-card h-64 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
        <div className="grid grid-cols-[repeat(7,minmax(168px,1fr))] lg:grid-cols-7 gap-3 min-w-[1176px] lg:min-w-0">
          {DAYS.map((day, idx) => (
            <div
              key={day.value}
              className={`glass-card flex flex-col p-3 min-h-[200px] ${
                idx === TODAY_INDEX ? "border-primary/40" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <p className="font-display text-sm font-semibold">{day.short}</p>
                  {idx === TODAY_INDEX && <p className="text-[10px] text-primary font-medium">Today</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => setAddDialogDay(day.value)}
                  aria-label={`Add class on ${day.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                {(byDay[day.value] ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60 text-center py-6">No classes</p>
                ) : (
                  byDay[day.value]!.map((slot) => <TimetableCard key={slot.id} slot={slot} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={addDialogDay !== null} onOpenChange={(open) => !open && setAddDialogDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to timetable</DialogTitle>
            <DialogDescription>This slot repeats every week.</DialogDescription>
          </DialogHeader>
          {addDialogDay && (
            <TimetableSlotForm
              defaultDay={addDialogDay}
              onSubmit={handleCreate}
              onCancel={() => setAddDialogDay(null)}
              submitting={createSlot.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
