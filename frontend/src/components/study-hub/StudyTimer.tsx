import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Timer as TimerIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useSubjects } from "@/hooks/useSubjects";
import { useStartStudySession, useUpdateStudySession } from "@/hooks/useStudySessions";
import { useNotifications } from "@/context/NotificationContext";
import { subjectColorHex } from "@/lib/subjectColors";
import { cn } from "@/lib/utils";
import type { StudySessionType } from "@/types";

const DURATIONS: { type: StudySessionType; label: string; minutes: number }[] = [
  { type: "pomodoro", label: "Pomodoro · 25 min", minutes: 25 },
  { type: "deep_work", label: "Deep work · 50 min", minutes: 50 },
];

type Phase = "idle" | "running" | "paused";

interface StudyTimerProps {
  defaultSubjectId?: string;
}

export function StudyTimer({ defaultSubjectId }: StudyTimerProps) {
  const { data: subjects } = useSubjects();
  const { notify, toast } = useNotifications();
  const startSession = useStartStudySession();
  const updateSession = useUpdateStudySession();

  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [durationIndex, setDurationIndex] = useState(0);
  const duration = DURATIONS[durationIndex];

  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(duration.minutes * 60);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Keep the idle countdown display in sync if the user changes duration
  // before starting.
  useEffect(() => {
    if (phase === "idle") setRemainingSeconds(duration.minutes * 60);
  }, [duration, phase]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  function tick() {
    setRemainingSeconds((prev) => {
      if (prev <= 1) {
        completeSession(true);
        return 0;
      }
      return prev - 1;
    });
  }

  function handleStart() {
    startSession.mutate(
      { subject_id: subjectId || null, session_type: duration.type },
      {
        onSuccess: (session) => {
          setSessionId(session.id);
          setPhase("running");
          intervalRef.current = window.setInterval(tick, 1000);
        },
      }
    );
  }

  function handlePauseResume() {
    if (phase === "running") {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      setPhase("paused");
    } else if (phase === "paused") {
      intervalRef.current = window.setInterval(tick, 1000);
      setPhase("running");
    }
  }

  function completeSession(autoFinished: boolean) {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (sessionId) {
      updateSession.mutate({ id: sessionId, payload: { complete_now: true } });
    }
    if (autoFinished) {
      notify("Study session complete", `Nice work — your ${duration.label.toLowerCase()} session is done.`);
      toast("Session complete! Great focus.", "success");
    }
    setPhase("idle");
    setSessionId(null);
    setRemainingSeconds(duration.minutes * 60);
  }

  const totalSeconds = duration.minutes * 60;
  const progressPct = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const ss = String(remainingSeconds % 60).padStart(2, "0");
  const activeSubject = subjects?.find((s) => s.id === subjectId);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <TimerIcon className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>Study Timer</CardTitle>
      </CardHeader>

      <div className="px-5 pb-5 flex flex-col items-center gap-5">
        <ProgressRing
          progress={progressPct}
          size={168}
          strokeWidth={8}
          color={activeSubject ? subjectColorHex(activeSubject.color) : "#D9A75B"}
        >
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {mm}:{ss}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1">
              {phase === "idle" ? duration.label : phase === "paused" ? "Paused" : "Focusing..."}
            </span>
          </div>
        </ProgressRing>

        {phase === "idle" && (
          <div className="w-full flex flex-col gap-2">
            <Select value={subjectId || "__none"} onValueChange={(v) => setSubjectId(v === "__none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No subject</SelectItem>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((d, i) => (
                <button
                  key={d.type}
                  type="button"
                  onClick={() => setDurationIndex(i)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    i === durationIndex
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 w-full">
          {phase === "idle" ? (
            <Button className="flex-1 gap-1.5" onClick={handleStart} disabled={startSession.isPending}>
              <Play className="h-4 w-4" /> Start focusing
            </Button>
          ) : (
            <>
              <Button variant="secondary" className="flex-1 gap-1.5" onClick={handlePauseResume}>
                {phase === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {phase === "running" ? "Pause" : "Resume"}
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => completeSession(false)}>
                <Square className="h-3.5 w-3.5" /> End session
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
