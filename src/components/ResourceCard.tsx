import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Video, LinkIcon, BookOpen, CheckSquare, FolderOpen,
  GripVertical, Trash2, Eye,
} from "lucide-react";
import { ResourceViewer } from "@/components/ResourceViewer";
import type { Tables } from "@/integrations/supabase/types";

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  video: Video,
  link: LinkIcon,
  document: BookOpen,
  checklist: CheckSquare,
  folder: FolderOpen,
  presentation: BookOpen,
};

interface ResourceCardProps {
  resource: Tables<"resources">;
  canManage: boolean;
  onDelete?: (id: string) => void;
}

export function ResourceCard({ resource, canManage, onDelete }: ResourceCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: resource.id, disabled: !canManage });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = typeIcons[resource.resource_type] || FileText;
  const url = resource.external_url || resource.file_url || resource.embed_url;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`transition-shadow ${isDragging ? "shadow-lg ring-2 ring-accent/30" : "hover:shadow-sm"}`}>
        <CardContent className="flex items-center gap-3 p-3">
          {canManage && (
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">{resource.title}</h4>
            {resource.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{resource.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">{resource.resource_type.toUpperCase()}</Badge>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent">
              {resource.file_url ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            </a>
          )}
          {canManage && onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onDelete(resource.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
