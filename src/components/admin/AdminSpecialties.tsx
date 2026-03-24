import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeanery } from "@/contexts/DeaneryContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Copy, ChevronRight, ChevronDown } from "lucide-react";
import { getIcon } from "@/lib/iconMap";
import { IconColorPicker } from "@/components/IconColorPicker";
import { toast } from "sonner";

export function AdminSpecialties() {
  const queryClient = useQueryClient();
  const { activeDeanery, allDeaneries } = useDeanery();
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [sourceDeaneryId, setSourceDeaneryId] = useState("");
  const [newSpec, setNewSpec] = useState({ name: "", short_name: "", slug: "", icon_name: "Stethoscope", color: "174 60% 40%" });
  const [parentId, setParentId] = useState<string>("none");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const { data: specialties, isLoading } = useQuery({
    queryKey: ["admin-specialties", activeDeanery?.id],
    queryFn: async () => {
      if (!activeDeanery) return [];
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("deanery_id", activeDeanery.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!activeDeanery,
  });

  // Source deanery specialties for cloning
  const { data: sourceSpecialties } = useQuery({
    queryKey: ["clone-source-specialties", sourceDeaneryId],
    queryFn: async () => {
      if (!sourceDeaneryId) return [];
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("deanery_id", sourceDeaneryId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!sourceDeaneryId,
  });

  const topLevel = specialties?.filter((s) => !s.parent_specialty_id) ?? [];
  const childrenOf = (parentId: string) =>
    specialties?.filter((s) => s.parent_specialty_id === parentId) ?? [];

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("specialties").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["my-specialties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      if (!specialties) return;
      const spec = specialties.find((s) => s.id === id);
      if (!spec) return;

      // Get siblings (same parent)
      const siblings = specialties
        .filter((s) => s.parent_specialty_id === spec.parent_specialty_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const idx = siblings.findIndex((s) => s.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return;

      const other = siblings[swapIdx];
      const tempOrder = spec.sort_order;

      await supabase.from("specialties").update({ sort_order: other.sort_order }).eq("id", spec.id);
      await supabase.from("specialties").update({ sort_order: tempOrder }).eq("id", other.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-specialties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSpecialty = useMutation({
    mutationFn: async () => {
      if (!activeDeanery) return;
      const maxOrder = specialties?.reduce((max, s) => Math.max(max, s.sort_order ?? 0), 0) ?? 0;
      const { error } = await supabase.from("specialties").insert({
        name: newSpec.name,
        short_name: newSpec.short_name,
        slug: newSpec.slug,
        icon_name: newSpec.icon_name,
        color: newSpec.color,
        deanery_id: activeDeanery.id,
        parent_specialty_id: parentId === "none" ? null : parentId,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Specialty created");
      queryClient.invalidateQueries({ queryKey: ["admin-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-specialties"] });
      setCreateOpen(false);
      setNewSpec({ name: "", short_name: "", slug: "", icon_name: "Stethoscope", color: "174 60% 40%" });
      setParentId("none");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloneFromDeanery = useMutation({
    mutationFn: async () => {
      if (!activeDeanery || !sourceSpecialties?.length) return;

      // Get existing slugs in target deanery to avoid duplicates
      const existingSlugs = new Set(specialties?.map((s) => s.slug) ?? []);
      const toClone = sourceSpecialties.filter((s) => !existingSlugs.has(s.slug));

      if (toClone.length === 0) {
        toast.info("All specialties from that deanery already exist here");
        return;
      }

      // Clone top-level first, then children
      const topLevel = toClone.filter((s) => !s.parent_specialty_id);
      const children = toClone.filter((s) => s.parent_specialty_id);

      // Map old IDs to new IDs for parent references
      const idMap: Record<string, string> = {};
      const maxOrder = specialties?.reduce((max, s) => Math.max(max, s.sort_order ?? 0), 0) ?? 0;

      for (let i = 0; i < topLevel.length; i++) {
        const s = topLevel[i];
        const { data, error } = await supabase.from("specialties").insert({
          name: s.name,
          short_name: s.short_name,
          slug: s.slug,
          icon_name: s.icon_name,
          color: s.color,
          deanery_id: activeDeanery.id,
          sort_order: maxOrder + i + 1,
          is_active: true,
        }).select("id").single();
        if (error) throw error;
        idMap[s.id] = data.id;
      }

      // Also map existing parent specialties in target deanery by slug
      for (const existing of (specialties ?? [])) {
        const source = sourceSpecialties.find((s) => s.slug === existing.slug);
        if (source) idMap[source.id] = existing.id;
      }

      for (let i = 0; i < children.length; i++) {
        const s = children[i];
        const newParentId = s.parent_specialty_id ? idMap[s.parent_specialty_id] : null;
        if (!newParentId) continue; // skip orphans

        const { error } = await supabase.from("specialties").insert({
          name: s.name,
          short_name: s.short_name,
          slug: s.slug,
          icon_name: s.icon_name,
          color: s.color,
          deanery_id: activeDeanery.id,
          parent_specialty_id: newParentId,
          sort_order: s.sort_order,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Specialties cloned successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-specialties"] });
      setCloneOpen(false);
      setSourceDeaneryId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const toggleParent = (id: string) =>
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));

  const otherDeaneries = allDeaneries.filter((d) => d.id !== activeDeanery?.id);

  const renderSpecialtyRow = (spec: any, isChild = false) => {
    const SIcon = getIcon(spec.icon_name);
    const color = spec.color ?? "174 60% 40%";
    const children = childrenOf(spec.id);
    const isExpanded = expandedParents[spec.id] ?? false;

    return (
      <div key={spec.id}>
        <Card className={`${!spec.is_active ? "opacity-50" : ""} ${isChild ? "ml-8 border-l-2 border-muted" : ""}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `hsl(${color} / 0.12)` }}
            >
              <SIcon className="h-4 w-4" style={{ color: `hsl(${color})` }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{spec.short_name}</span>
                {!spec.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                {isChild && <Badge variant="outline" className="text-[10px]">Subspecialty</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{spec.name}</p>
            </div>

            {!isChild && children.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => toggleParent(spec.id)}>
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {children.length} sub
              </Button>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col gap-0.5">
                <button
                  className="text-muted-foreground hover:text-foreground text-xs px-1"
                  onClick={() => reorder.mutate({ id: spec.id, direction: "up" })}
                >▲</button>
                <button
                  className="text-muted-foreground hover:text-foreground text-xs px-1"
                  onClick={() => reorder.mutate({ id: spec.id, direction: "down" })}
                >▼</button>
              </div>
              <Switch
                checked={spec.is_active}
                onCheckedChange={(v) => toggleActive.mutate({ id: spec.id, is_active: v })}
              />
            </div>
          </CardContent>
        </Card>

        {!isChild && isExpanded && children.length > 0 && (
          <div className="space-y-1.5 mt-1.5">
            {children.map((child) => renderSpecialtyRow(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage specialties for <span className="font-medium text-foreground">{activeDeanery?.name ?? "—"}</span>.
            Toggle on/off and reorder.
          </p>
        </div>
        <div className="flex gap-2">
          {otherDeaneries.length > 0 && (
            <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Copy className="h-4 w-4" /> Copy from Deanery
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Copy Specialties from Another Deanery</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    This will copy all specialties from the selected deanery that don't already exist in {activeDeanery?.name}.
                  </p>
                  <div className="space-y-1.5">
                    <Label>Source Deanery</Label>
                    <Select value={sourceDeaneryId} onValueChange={setSourceDeaneryId}>
                      <SelectTrigger><SelectValue placeholder="Select deanery…" /></SelectTrigger>
                      <SelectContent>
                        {otherDeaneries.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {sourceSpecialties && sourceSpecialties.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {sourceSpecialties.filter((s) => !s.parent_specialty_id).length} specialties and{" "}
                      {sourceSpecialties.filter((s) => s.parent_specialty_id).length} subspecialties available to copy.
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => cloneFromDeanery.mutate()}
                    disabled={!sourceDeaneryId || cloneFromDeanery.isPending}
                  >
                    {cloneFromDeanery.isPending ? "Copying…" : "Copy Specialties"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Specialty</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Specialty</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={newSpec.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setNewSpec((f) => ({
                        ...f,
                        name,
                        slug: generateSlug(name),
                        short_name: f.short_name || "",
                      }));
                    }}
                    placeholder="e.g. General Surgery"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Short Name</Label>
                    <Input
                      value={newSpec.short_name}
                      onChange={(e) => setNewSpec((f) => ({ ...f, short_name: e.target.value }))}
                      placeholder="e.g. Gen Surg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <Input
                      value={newSpec.slug}
                      onChange={(e) => setNewSpec((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="e.g. general-surgery"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Parent Specialty (optional)</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top-level)</SelectItem>
                      {topLevel.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createSpecialty.mutate()}
                  disabled={!newSpec.name || !newSpec.short_name || !newSpec.slug || createSpecialty.isPending}
                >
                  {createSpecialty.isPending ? "Creating…" : "Create Specialty"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : !specialties?.length ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">No specialties configured for this deanery.</p>
          {otherDeaneries.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCloneOpen(true)}>
              <Copy className="h-4 w-4" /> Copy from another deanery
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {topLevel.map((spec) => renderSpecialtyRow(spec))}
        </div>
      )}
    </div>
  );
}
