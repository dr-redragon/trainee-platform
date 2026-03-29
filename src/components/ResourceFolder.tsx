import { useState, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  FolderOpen, FolderClosed, ChevronDown, MoreVertical, Pencil, Trash2, Upload, FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { ResourceCard } from "@/components/ResourceCard";
import type { Tables } from "@/integrations/supabase/types";

interface ResourceFolderProps {
  folder: { id: string; name: string; subsection_id: string; subheading: string | null; sort_order: number | null };
  resources: Tables<"resources">[];
  canManage: boolean;
  specialtyId: string;
  onDeleteResource: (id: string) => void;
  existingSubheadings: string[];
}

export function ResourceFolder({
  folder,
  resources,
  canManage,
  specialtyId,
  onDeleteResource,
  existingSubheadings,
}: ResourceFolderProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const renameFolder = useMutation({
    mutationFn: async () => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === folder.name) return;
      const { error } = await supabase
        .from("resource_folders")
        .update({ name: trimmed } as any)
        .eq("id", folder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder renamed");
      queryClient.invalidateQueries({ queryKey: ["resource-folders"] });
      setRenaming(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async () => {
      // Unassign resources from folder first
      for (const r of resources) {
        await supabase.from("resources").update({ folder_id: null } as any).eq("id", r.id);
      }
      const { error } = await supabase.from("resource_folders").delete().eq("id", folder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder deleted — resources moved out");
      queryClient.invalidateQueries({ queryKey: ["resource-folders"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleBulkUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Get max sort_order in this subsection
      const { data: existing } = await supabase
        .from("resources")
        .select("sort_order")
        .eq("subsection_id", folder.subsection_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${specialtyId}/${folder.subsection_id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("resources").upload(path, file);
        if (uploadErr) { toast.error(`Failed: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("resources").getPublicUrl(path);

        let resourceType = "document";
        if (file.type === "application/pdf") resourceType = "pdf";
        else if (file.type.startsWith("video/")) resourceType = "video";
        else if (file.name.endsWith(".pptx") || file.name.endsWith(".ppt")) resourceType = "presentation";

        const { error } = await supabase.from("resources").insert({
          title: file.name.replace(/\.[^.]+$/, ""),
          resource_type: resourceType as any,
          subsection_id: folder.subsection_id,
          file_url: urlData.publicUrl,
          added_by: user?.id ?? null,
          sort_order: nextOrder++,
          subheading: folder.subheading,
          folder_id: folder.id,
        } as any);
        if (error) toast.error(`Failed: ${file.name}`);
      }
      toast.success(`${files.length} file(s) uploaded`);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      handleBulkUpload(e.dataTransfer.files);
    }
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card
          className={`transition-colors ${dragOver ? "ring-2 ring-accent/40 bg-accent/5" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 flex-1 min-w-0 group">
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-0" : "-rotate-90"}`} />
                  {open ? (
                    <FolderOpen className="h-4.5 w-4.5 text-accent shrink-0" />
                  ) : (
                    <FolderClosed className="h-4.5 w-4.5 text-muted-foreground group-hover:text-accent shrink-0" />
                  )}
                  {renaming ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-7 text-sm w-40"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameFolder.mutate();
                          if (e.key === "Escape") { setRenaming(false); setNewName(folder.name); }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); renameFolder.mutate(); }}>
                        <Pencil className="h-3 w-3 text-accent" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                      {folder.name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">({resources.length})</span>
                </button>
              </CollapsibleTrigger>

              {canManage && !renaming && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    disabled={uploading}
                  >
                    <Upload className="h-3 w-3" />
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) handleBulkUpload(e.target.files); }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenaming(true); setNewName(folder.name); }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-2 border-t pt-2">
                {resources.length === 0 ? (
                  <div className="flex items-center justify-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                    Drop files here or click Upload
                  </div>
                ) : (
                  resources.map((r) => (
                    <ResourceCard
                      key={r.id}
                      resource={r}
                      canManage={canManage}
                      onDelete={onDeleteResource}
                      existingSubheadings={existingSubheadings}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Delete Folder Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{folder.name}"</DialogTitle>
            <DialogDescription>
              {resources.length > 0
                ? `This folder has ${resources.length} resource(s). They will be moved out of the folder but not deleted.`
                : "This empty folder will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteFolder.isPending} onClick={() => deleteFolder.mutate()}>
              {deleteFolder.isPending ? "Deleting…" : "Delete Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
