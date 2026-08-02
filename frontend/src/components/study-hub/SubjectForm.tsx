import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUBJECT_COLORS, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";
import { cn } from "@/lib/utils";
import type { Subject, SubjectInput } from "@/types";

interface SubjectFormProps {
  initial?: Subject;
  onSubmit: (payload: SubjectInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function SubjectForm({ initial, onSubmit, onCancel, submitting }: SubjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [color, setColor] = useState(initial?.color ?? "purple");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), code: code.trim(), instructor: instructor.trim(), color });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject-name">Subject name</Label>
        <Input
          id="subject-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Data Structures & Algorithms"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject-code">Course code</Label>
          <Input id="subject-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CS 301" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject-instructor">Instructor</Label>
          <Input
            id="subject-instructor"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="e.g. Dr. Chen"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Color tag</Label>
        <div className="flex gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-transform",
                color === c ? "border-white scale-110" : "border-transparent"
              )}
              aria-label={`Color ${c}`}
            >
              <span className={cn("h-4 w-4 rounded-full", SUBJECT_COLOR_CLASSES[c].dot)} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {initial ? "Save changes" : "Add subject"}
        </Button>
      </div>
    </form>
  );
}
