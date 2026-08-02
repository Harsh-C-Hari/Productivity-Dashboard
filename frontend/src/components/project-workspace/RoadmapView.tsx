import { useEffect, useState } from "react";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, GitBranch, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/project-workspace/StatusBadge";
import { PhaseForm } from "@/components/project-workspace/PhaseForm";
import {
  usePhases,
  useCreatePhase,
  useUpdatePhase,
  useDeletePhase,
  useReorderPhases,
} from "@/hooks/usePhases";
import { PHASE_STATUS_META } from "@/lib/projectMeta";
import type { ProjectPhase, ProjectPhaseInput } from "@/types";

export function RoadmapView({ projectId }: { projectId: string }) {
  const { data: phases, isLoading } = usePhases({ projectId });
  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const reorderPhases = useReorderPhases();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectPhase | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectPhase | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sorted = [...(phases ?? [])].sort((a, b) => a.order_index - b.order_index);
  const [localOrder, setLocalOrder] = useState<ProjectPhase[]>(sorted);

  // Keep local drag order in sync with server data, but never clobber an
  // in-progress drag with a mid-flight refetch.
  useEffect(() => {
    if (!isDragging) setLocalOrder(sorted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, isDragging]);

  function handleSubmit(payload: ProjectPhaseInput) {
    if (editing) {
      updatePhase.mutate({ id: editing.id, payload }, { onSuccess: () => closeForm() });
    } else {
      createPhase.mutate(payload, { onSuccess: () => closeForm() });
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function persistOrder(order: ProjectPhase[]) {
    reorderPhases.mutate(order.map((p, i) => ({ id: p.id, order_index: i })));
  }

  function move(phase: ProjectPhase, direction: -1 | 1) {
    const idx = localOrder.findIndex((p) => p.id === phase.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= localOrder.length) return;
    const next = [...localOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setLocalOrder(next);
    persistOrder(next);
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading roadmap…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Roadmap</h3>
          <p className="text-xs text-muted-foreground">Phases in build order, from foundation to ship.</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Add phase
        </Button>
      </div>

      {localOrder.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No phases yet. Break this project into build phases.</p>
        </Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" />
          <Reorder.Group
            as="div"
            axis="y"
            values={localOrder}
            onReorder={setLocalOrder}
            className="flex flex-col gap-3"
          >
            <AnimatePresence initial={false}>
              {localOrder.map((phase, i) => (
                <PhaseRow
                  key={phase.id}
                  phase={phase}
                  index={i}
                  isFirst={i === 0}
                  isLast={i === localOrder.length - 1}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={() => {
                    setIsDragging(false);
                    persistOrder(localOrder);
                  }}
                  onMove={move}
                  onEdit={() => {
                    setEditing(phase);
                    setFormOpen(true);
                  }}
                  onDelete={() => setConfirmDelete(phase)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit phase" : "Add phase"}</DialogTitle>
            <DialogDescription>Phases group features, todos, bugs, and milestones by build stage.</DialogDescription>
          </DialogHeader>
          <PhaseForm
            projectId={projectId}
            initial={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            submitting={createPhase.isPending || updatePhase.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{confirmDelete?.title}"?</DialogTitle>
            <DialogDescription>
              Features, todos, bugs, and milestones linked to this phase will be unlinked, not deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) deletePhase.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PhaseRowProps {
  phase: ProjectPhase;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (phase: ProjectPhase, direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** A single draggable roadmap row. Dragging is opt-in via the grip
 * handle (`dragListener={false}` + `dragControls`), so clicking the
 * card body, progress bar, or action buttons never accidentally
 * starts a drag. The up/down buttons remain as a fully equivalent,
 * keyboard-and-screen-reader-operable way to reorder -- dragging is
 * an addition, not a replacement, since native drag gestures aren't
 * reachable without a pointer. */
function PhaseRow({ phase, index, isFirst, isLast, onDragStart, onDragEnd, onMove, onEdit, onDelete }: PhaseRowProps) {
  const meta = PHASE_STATUS_META[phase.status];
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={phase}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="relative list-none"
    >
      <span className={`absolute -left-6 top-5 h-3 w-3 rounded-full border-2 border-base-950 ${meta.dot}`} />
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <button
              type="button"
              onPointerDown={(e) => controls.start(e)}
              className="mt-1 shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
              aria-label={`Drag to reorder "${phase.title}"`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                <h4 className="font-medium text-sm">{phase.title}</h4>
                <StatusBadge label={meta.label} colorClass={meta.color} textClass={meta.text} dotClass={meta.dot} />
              </div>
              {phase.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{phase.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Progress value={phase.progress} className="h-1.5 flex-1" />
                <span className="text-[11px] font-mono text-muted-foreground w-9 text-right">
                  {phase.progress}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 shrink-0">
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMove(phase, -1)}
                disabled={isFirst}
                aria-label={`Move "${phase.title}" up`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMove(phase, 1)}
                disabled={isLast}
                aria-label={`Move "${phase.title}" down`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={`Edit "${phase.title}"`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
                onClick={onDelete}
                aria-label={`Delete "${phase.title}"`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Reorder.Item>
  );
}
