import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2, Check, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// On-screen crop window (square, with a circular guide drawn over it) and
// the resolution we export at -- output is a plain square JPEG; the circle
// is just a crop guide, since every avatar consumer in the app already
// clips to a circle/rounded-box with CSS (object-cover).
const VIEWPORT = 240;
const OUTPUT_SIZE = 512;

interface AvatarCropperDialogProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (dataUrl: string) => void;
}

/** A minimal, dependency-free "pick a photo -> pan & zoom -> crop" flow,
 * modeled on the classic WhatsApp/Instagram avatar picker. */
export function AvatarCropperDialog({ file, open, onOpenChange, onCropped }: AvatarCropperDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const baseScale = naturalSize.w && naturalSize.h ? VIEWPORT / Math.min(naturalSize.w, naturalSize.h) : 1;
  const scale = baseScale * zoom;
  const dispW = naturalSize.w * scale;
  const dispH = naturalSize.h * scale;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(x, VIEWPORT - dispW)),
      y: Math.min(0, Math.max(y, VIEWPORT - dispH)),
    }),
    [dispW, dispH]
  );

  // Load the freshly picked file and reset crop state for it.
  useEffect(() => {
    if (!file) {
      setReady(false);
      setImgSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setImgSrc(url);
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Center the image the moment it (re)loads.
  useEffect(() => {
    if (!ready) return;
    setPos({ x: (VIEWPORT - dispW) / 2, y: (VIEWPORT - dispH) / 2 });
    // Only re-center on a fresh image, not on every zoom tick (see clamp effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the pan position valid whenever zoom changes the displayed size.
  useEffect(() => {
    if (!ready) return;
    setPos((p) => clamp(p.x, p.y));
  }, [zoom, ready, clamp]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sSize = VIEWPORT / scale;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      onCropped(canvas.toDataURL("image/jpeg", 0.92));
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update profile photo</DialogTitle>
          <DialogDescription>Drag to reposition, use the slider to zoom.</DialogDescription>
        </DialogHeader>

        {ready && imgSrc ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative touch-none select-none overflow-hidden rounded-2xl bg-base-900"
              style={{ width: VIEWPORT, height: VIEWPORT }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <img
                src={imgSrc}
                alt=""
                draggable={false}
                className="absolute pointer-events-none max-w-none"
                style={{ width: dispW, height: dispH, left: pos.x, top: pos.y }}
              />
              {/* Circular crop guide -- a big spread box-shadow dims everything
                  outside the circle, clipped by the container's overflow-hidden. */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 999px rgba(6, 6, 12, 0.72)" }}
              />
            </div>

            <div className="flex w-full items-center gap-3">
              <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!ready || exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Use photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
