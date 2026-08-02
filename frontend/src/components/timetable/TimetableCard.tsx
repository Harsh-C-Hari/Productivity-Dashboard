import { useState } from "react";
import { Pencil, Trash2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimetableSlotForm } from "@/components/timetable/TimetableSlotForm";
import { useDeleteSlot, useUpdateSlot } from "@/hooks/useTimetable";
import type { TimetableSlot, TimetableSlotInput } from "@/types";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  purple: "border-l-primary bg-primary/[0.07]",
  blue: "border-l-secondary bg-secondary/[0.07]",
  cyan: "border-l-accent bg-accent/[0.07]",
  pink: "border-l-[#C98FA0] bg-[#C98FA0]/[0.07]",
  green: "border-l-urgency-low bg-urgency-low/[0.07]",
  orange: "border-l-urgency-high bg-urgency-high/[0.07]",
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function TimetableCard({ slot }: { slot: TimetableSlot }) {
  const [editOpen, setEditOpen] = useState(false);
  const updateSlot = useUpdateSlot();
  const deleteSlot = useDeleteSlot();

  function handleSubmit(payload: TimetableSlotInput) {
    updateSlot.mutate({ id: slot.id, payload }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border-l-4 border border-white/[0.06] p-3 transition-colors hover:border-white/20",
          COLOR_MAP[slot.color] ?? COLOR_MAP.purple
        )}
      >
        <p className="text-sm font-medium leading-snug pr-16">{slot.title}</p>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">
          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
        </p>
        {slot.location && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" /> {slot.location}
          </p>
        )}

        <div className="absolute top-2 right-2 flex opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit class">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
            onClick={() => deleteSlot.mutate(slot.id)}
            aria-label="Delete class"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit class</DialogTitle>
            <DialogDescription>Update this recurring weekly slot.</DialogDescription>
          </DialogHeader>
          <TimetableSlotForm
            initial={slot}
            onSubmit={handleSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateSlot.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
