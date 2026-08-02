import { useRef } from "react";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, FileArchive, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttachmentMeta } from "@/types";
import { cn } from "@/lib/utils";

function iconFor(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.includes("zip")) return FileArchive;
  if (contentType.includes("pdf") || contentType.includes("word") || contentType.includes("presentation")) return FileText;
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentListProps {
  attachments: AttachmentMeta[];
  onUpload: (file: File) => void;
  onDelete: (filename: string) => void;
  uploading?: boolean;
  className?: string;
}

export function AttachmentList({ attachments, onUpload, onDelete, uploading, className }: AttachmentListProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((att) => {
            const Icon = iconFor(att.content_type);
            return (
              <li
                key={att.filename}
                className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-base-900/40 px-3 py-2"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-foreground/90 hover:text-primary transition-colors"
                >
                  {att.original_name}
                </a>
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">{formatSize(att.size_bytes)}</span>
                <button
                  type="button"
                  onClick={() => onDelete(att.filename)}
                  className="flex h-8 w-8 shrink-0 -my-2 -mr-1 items-center justify-center rounded-md text-muted-foreground hover:text-urgency-critical hover:bg-white/5 transition-colors"
                  aria-label={`Remove ${att.original_name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start gap-1.5"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : "Attach file"}
      </Button>
    </div>
  );
}
