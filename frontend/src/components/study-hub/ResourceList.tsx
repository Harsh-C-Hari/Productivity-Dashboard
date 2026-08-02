import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ResourceCard } from "@/components/study-hub/ResourceCard";
import { ResourceForm } from "@/components/study-hub/ResourceForm";
import { useResources } from "@/hooks/useResources";
import type { ResourceType } from "@/types";

const TYPE_OPTIONS: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "pdf", label: "PDF" },
  { value: "ppt", label: "Slides" },
  { value: "docx", label: "Docs" },
  { value: "image", label: "Images" },
  { value: "zip", label: "ZIP" },
  { value: "link", label: "Links" },
];

interface ResourceListProps {
  subjectId?: string;
  topicId?: string;
}

export function ResourceList({ subjectId, topicId }: ResourceListProps) {
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");
  const { data: resources, isLoading } = useResources({
    subjectId,
    topicId,
    resourceType: typeFilter === "all" ? undefined : typeFilter,
  });
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 sm:justify-between">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ResourceType | "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add resource
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card h-20 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!isLoading && (resources ?? []).length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-display text-lg font-semibold">Library is empty</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Upload lecture slides, PDFs, or link course materials here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence initial={false}>
          {(resources ?? []).map((resource) => (
            <ResourceCard key={resource.id} resource={resource} hideSubject={!!subjectId} />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add resource</DialogTitle>
            <DialogDescription>Upload a file or link to something external.</DialogDescription>
          </DialogHeader>
          <ResourceForm defaultSubjectId={subjectId} onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
