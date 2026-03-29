import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { Constants } from "@/integrations/supabase/types";

interface AddResourceDialogProps {
  subsectionId: string;
  specialtyId: string;
  existingSubheadings?: string[];
}

export function AddResourceDialog({ subsectionId, specialtyId, existingSubheadings = [] }: AddResourceDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<string>("document");
  const [externalUrl, setExternalUrl] = useState("");
  const [subheading, setSubheading] = useState("");
  const [customSubheading, setCustomSubheading] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) {
      // Multi-file: trigger bulk upload
      handleBulkUpload(files);
      return;
    }
    const f = files[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      if (f.type === "application/pdf") setResourceType("pdf");
      else if (f.type.startsWith("video/")) setResourceType("video");
      else if (f.name.endsWith(".pptx") || f.name.endsWith(".ppt")) setResourceType("presentation");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 1) {
      handleBulkUpload(files);
      return;
    }
    const f = files[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      if (f.type === "application/pdf") setResourceType("pdf");
      else if (f.type.startsWith("video/")) setResourceType("video");
    }
  };

  const handleBulkUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existing } = await supabase
        .from("resources")
        .select("sort_order")
        .eq("subsection_id", subsectionId)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextOrder = ((existing?.[0]?.sort_order ?? -1) + 1);
      const finalSubheading = subheading === "__new__" ? customSubheading.trim() : subheading;
      setUploadProgress({ current: 0, total: files.length, fileName: "" });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
        const ext = file.name.split(".").pop();
        const path = `${specialtyId}/${subsectionId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("resources").upload(path, file);
        if (uploadErr) { toast.error(`Failed: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("resources").getPublicUrl(path);

        let rType = "document";
        if (file.type === "application/pdf") rType = "pdf";
        else if (file.type.startsWith("video/")) rType = "video";
        else if (file.name.endsWith(".pptx") || file.name.endsWith(".ppt")) rType = "presentation";

        await supabase.from("resources").insert({
          title: file.name.replace(/\.[^.]+$/, ""),
          resource_type: rType as any,
          subsection_id: subsectionId,
          file_url: urlData.publicUrl,
          added_by: user?.id ?? null,
          sort_order: nextOrder++,
          subheading: finalSubheading || null,
        } as any);
      }
      toast.success(`${files.length} files uploaded`);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const addResource = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let fileUrl: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${specialtyId}/${subsectionId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("resources").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("resources").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { data: { user } } = await supabase.auth.getUser();
      // Get max sort_order
      const { data: existing } = await supabase
        .from("resources")
        .select("sort_order")
        .eq("subsection_id", subsectionId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = ((existing?.[0]?.sort_order ?? -1) + 1);

      const finalSubheading = subheading === "__new__" ? customSubheading.trim() : subheading;

      const { error } = await supabase.from("resources").insert({
        title: title.trim(),
        description: description.trim() || null,
        resource_type: resourceType as any,
        subsection_id: subsectionId,
        external_url: externalUrl.trim() || null,
        file_url: fileUrl,
        added_by: user?.id ?? null,
        sort_order: nextOrder,
        subheading: finalSubheading || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resource added");
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const resetForm = () => {
    setOpen(false);
    setTitle("");
    setDescription("");
    setResourceType("document");
    setExternalUrl("");
    setSubheading("");
    setCustomSubheading("");
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Drag-and-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? "border-accent bg-accent/5" : file ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/40"
            }`}
          >
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileUp className="h-5 w-5 text-accent" />
                <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                <button className="text-xs text-destructive hover:underline" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop file(s) here, or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Drop multiple files for bulk upload</p>
              </>
            )}
          </div>

          {uploading && uploadProgress.total > 0 && (
            <UploadProgressBar current={uploadProgress.current} total={uploadProgress.total} currentFileName={uploadProgress.fileName} />
          )}

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.resource_type.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>External URL (optional)</Label>
              <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subheading (optional)</Label>
            <Select value={subheading} onValueChange={setSubheading}>
              <SelectTrigger><SelectValue placeholder="No subheading" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No subheading</SelectItem>
                {existingSubheadings.map((sh) => (
                  <SelectItem key={sh} value={sh}>{sh}</SelectItem>
                ))}
                <SelectItem value="__new__">+ Create new subheading</SelectItem>
              </SelectContent>
            </Select>
            {subheading === "__new__" && (
              <Input
                value={customSubheading}
                onChange={(e) => setCustomSubheading(e.target.value)}
                placeholder="Enter new subheading name…"
                className="mt-1.5"
              />
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => addResource.mutate()}
            disabled={!title.trim() || uploading}
          >
            {uploading ? "Uploading…" : "Add Resource"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
