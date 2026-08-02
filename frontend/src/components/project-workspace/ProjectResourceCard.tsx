import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  Link as LinkIcon,
  File as FileIcon,
  Presentation,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDeleteProjectResource } from "@/hooks/useProjectResources";
import type { ProjectResource, ResourceType } from "@/types";

const TYPE_ICON: Record<ResourceType, typeof FileIcon> = {
  pdf: FileText,
  ppt: Presentation,
  docx: FileText,
  image: ImageIcon,
  zip: FileArchive,
  link: LinkIcon,
  other: FileIcon,
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectResourceCard({ resource }: { resource: ProjectResource }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteResource = useDeleteProjectResource();
  const Icon = TYPE_ICON[resource.resource_type] ?? FileIcon;
  const href = resource.resource_type === "link" ? resource.external_url : resource.file_path;

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
        <Card className="group p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <a
              href={href ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            >
              <span className="truncate">{resource.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
              <span className="uppercase">{resource.resource_type}</span>
              {resource.file_size_bytes && <span>· {formatSize(resource.file_size_bytes)}</span>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-urgency-critical transition-opacity"
            onClick={() => setConfirmDelete(true)}
            aria-label="Remove resource"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Card>
      </motion.div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove "{resource.title}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteResource.mutate(resource.id);
                setConfirmDelete(false);
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
