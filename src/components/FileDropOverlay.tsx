import { UploadCloud } from "lucide-react";

interface FileDropOverlayProps {
  active: boolean;
  itemCount?: number;
  label?: string;
  /** Use absolute positioning to overlay parent (parent must be relative). Default true. */
  absolute?: boolean;
  /** Compact variant with smaller icon/text — for small drop zones. */
  compact?: boolean;
}

/**
 * Animated visual feedback shown while the user is dragging files over a drop zone.
 * Renders a dashed accent overlay, animated upload-cloud icon and a contextual label.
 */
export function FileDropOverlay({
  active,
  itemCount,
  label = "Drop to upload",
  absolute = true,
  compact = false,
}: FileDropOverlayProps) {
  if (!active) return null;

  const count = itemCount && itemCount > 0 ? itemCount : null;
  const itemLabel = count
    ? `${count} ${count === 1 ? "item" : "items"} ready to upload`
    : "Release to upload";

  return (
    <div
      className={`${
        absolute ? "absolute inset-0" : ""
      } z-20 flex items-center justify-center pointer-events-none rounded-lg
        bg-accent/10 backdrop-blur-[2px]
        border-2 border-dashed border-accent
        animate-fade-in`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2 text-accent animate-scale-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
          <div
            className={`relative rounded-full bg-accent/15 ring-2 ring-accent/40 ${
              compact ? "p-2" : "p-3"
            }`}
          >
            <UploadCloud
              className={`${compact ? "h-5 w-5" : "h-7 w-7"} text-accent animate-bounce`}
              strokeWidth={2.25}
            />
          </div>
        </div>
        <div className="text-center">
          <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>{label}</p>
          <p
            className={`text-accent/80 ${
              compact ? "text-[10px]" : "text-xs"
            } mt-0.5`}
          >
            {itemLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
