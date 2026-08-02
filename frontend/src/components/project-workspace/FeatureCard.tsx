import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Layers } from "lucide-react";
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
import { FeatureForm } from "@/components/project-workspace/FeatureForm";
import { useUpdateFeature, useDeleteFeature } from "@/hooks/useFeatures";
import { FEATURE_STATUS_META, PRIORITY_META } from "@/lib/projectMeta";
import type { Feature, FeatureInput } from "@/types";

export function FeatureCard({ feature }: { feature: Feature }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateFeature = useUpdateFeature();
  const deleteFeature = useDeleteFeature();

  const statusMeta = FEATURE_STATUS_META[feature.status];
  const priorityMeta = PRIORITY_META[feature.priority];

  function handleEditSubmit(payload: FeatureInput) {
    updateFeature.mutate({ id: feature.id, payload }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className="group p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <h4 className="font-medium text-sm truncate">{feature.title}</h4>
              </div>
              {feature.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{feature.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge label={statusMeta.label} colorClass={statusMeta.color} textClass={statusMeta.text} dotClass={statusMeta.dot} />
                <StatusBadge label={priorityMeta.label} colorClass={priorityMeta.color} textClass={priorityMeta.text} dotClass={priorityMeta.dot} />
                {feature.phase_title && (
                  <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full border border-white/10">
                    {feature.phase_title}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-urgency-critical"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Progress value={feature.progress} className="h-1.5 flex-1" />
            <span className="text-[11px] font-mono text-muted-foreground w-9 text-right">{feature.progress}%</span>
            {feature.estimated_effort_hours > 0 && (
              <span className="text-[11px] text-muted-foreground shrink-0">{feature.estimated_effort_hours}h est.</span>
            )}
          </div>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit feature</DialogTitle>
            <DialogDescription>Update this feature's details.</DialogDescription>
          </DialogHeader>
          <FeatureForm
            projectId={feature.project_id}
            initial={feature}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={updateFeature.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{feature.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteFeature.mutate(feature.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
