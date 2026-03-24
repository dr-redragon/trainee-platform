import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText, AlertTriangle } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { Tables } from "@/integrations/supabase/types";

interface ResourceViewerProps {
  resource: Tables<"resources"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getViewerUrl(resource: Tables<"resources">): string | null {
  const url = resource.file_url || resource.external_url || resource.embed_url;
  if (!url) return null;

  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.endsWith(".docx") ||
    lowerUrl.endsWith(".doc") ||
    lowerUrl.endsWith(".pptx") ||
    lowerUrl.endsWith(".ppt") ||
    lowerUrl.endsWith(".xlsx") ||
    lowerUrl.endsWith(".xls")
  ) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }

  return url;
}

function isVideo(resource: Tables<"resources">): boolean {
  if (resource.resource_type === "video") return true;
  const url = resource.file_url || resource.external_url || "";
  return /\.(mp4|webm|ogg)$/i.test(url);
}

function isYouTube(resource: Tables<"resources">): string | null {
  const url = resource.external_url || resource.embed_url || "";
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function ResourceViewer({ resource, open, onOpenChange }: ResourceViewerProps) {
  if (!resource) return null;

  const rawUrl = resource.file_url || resource.external_url || resource.embed_url;
  const viewerUrl = getViewerUrl(resource);
  const ytId = isYouTube(resource);
  const video = isVideo(resource);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (rawUrl) window.open(rawUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (resource.file_url) {
      const a = document.createElement("a");
      a.href = resource.file_url;
      a.download = resource.title || "download";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <VisuallyHidden>
          <DialogTitle>{resource.title}</DialogTitle>
          <DialogDescription>Viewing resource: {resource.title}</DialogDescription>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30 pr-12">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{resource.title}</h3>
            {resource.description && (
              <p className="text-xs text-muted-foreground truncate">{resource.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {resource.resource_type.toUpperCase()}
          </Badge>
          {rawUrl && (
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          )}
          {resource.file_url && (
            <a
              href={resource.file_url}
              download={resource.title || "download"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=0`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={resource.title}
            />
          ) : video && rawUrl ? (
            <div className="flex items-center justify-center h-full p-4">
              <video controls className="max-w-full max-h-full rounded-lg shadow-lg" src={rawUrl}>
                Your browser does not support the video tag.
              </video>
            </div>
          ) : viewerUrl ? (
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={resource.title}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 opacity-40" />
              <p className="text-sm">No viewable content available for this resource.</p>
              {rawUrl && (
                <Button variant="outline" size="sm" onClick={handleOpen}>
                  Open in new tab <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
