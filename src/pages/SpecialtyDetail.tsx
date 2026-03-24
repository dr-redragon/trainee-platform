import { useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ContactCard } from "@/components/ContactCard";
import { DiscussionBoard } from "@/components/DiscussionBoard";
import { ResourceCard } from "@/components/ResourceCard";
import { AddResourceDialog } from "@/components/AddResourceDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useCanManageSpecialty } from "@/hooks/useUserRole";
import { getIcon } from "@/lib/iconMap";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { Tables } from "@/integrations/supabase/types";

const SpecialtyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: canManage } = useCanManageSpecialty(id);
  const discussionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.hash === "#discussion" && discussionRef.current) {
      setTimeout(() => discussionRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [location.hash]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch specialty from DB
  const { data: specialty, isLoading: specLoading } = useQuery({
    queryKey: ["specialty", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch subsections
  const { data: subsections } = useQuery({
    queryKey: ["subsections", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subsections")
        .select("*")
        .eq("specialty_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all resources for this specialty's subsections
  const subsectionIds = subsections?.map((s) => s.id) ?? [];
  const { data: resources } = useQuery({
    queryKey: ["resources", id, subsectionIds],
    queryFn: async () => {
      if (!subsectionIds.length) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .in("subsection_id", subsectionIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: subsectionIds.length > 0,
  });

  // Contacts for this specialty
  const { data: contacts } = useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .or(`specialty_id.eq.${id},specialty_id.is.null`)
        .eq("archived", false);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const deleteResource = useMutation({
    mutationFn: async (resourceId: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", resourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resource deleted");
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderResources = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const u of updates) {
        await supabase.from("resources").update({ sort_order: u.sort_order }).eq("id", u.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });

  const handleDragEnd = (event: DragEndEvent, subsectionResources: Tables<"resources">[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subsectionResources.findIndex((r) => r.id === active.id);
    const newIndex = subsectionResources.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(subsectionResources, oldIndex, newIndex);
    const updates = reordered.map((r, i) => ({ id: r.id, sort_order: i }));
    // Optimistic update
    queryClient.setQueryData(["resources", id, subsectionIds], (old: Tables<"resources">[] | undefined) => {
      if (!old) return old;
      const otherResources = old.filter((r) => r.subsection_id !== subsectionResources[0]?.subsection_id);
      return [...otherResources, ...reordered.map((r, i) => ({ ...r, sort_order: i }))];
    });
    reorderResources.mutate(updates);
  };

  if (specLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!specialty) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Specialty not found.
        </div>
      </DashboardLayout>
    );
  }

  const Icon = getIcon(specialty.icon_name);
  const color = specialty.color ?? "174 60% 40%";
  const tabNames = [...(subsections?.map((s) => s.name) ?? []), "Key Contacts"];
  const defaultTab = subsections?.[0]?.name ?? "Key Contacts";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `hsl(${color} / 0.12)` }}
          >
            <Icon className="h-6 w-6" style={{ color: `hsl(${color})` }} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">{specialty.short_name}</h1>
            <p className="text-sm text-muted-foreground">{specialty.name}</p>
          </div>
          {canManage && (
            <Badge variant="outline" className="ml-auto text-[10px] text-accent border-accent/30">
              ✏️ Editing enabled
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-secondary/50 p-1">
            {tabNames.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs whitespace-nowrap">
                {tab === "Key Contacts" && <Users className="h-3 w-3 mr-1" />}
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Resource subsection tabs */}
          {subsections?.map((sub) => {
            const subResources = (resources ?? [])
              .filter((r) => r.subsection_id === sub.id)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

            return (
              <TabsContent key={sub.id} value={sub.name} className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{sub.name}</h3>
                  {canManage && (
                    <AddResourceDialog subsectionId={sub.id} specialtyId={specialty.id} />
                  )}
                </div>

                {subResources.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No resources yet</p>
                      {canManage && <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Resource" to get started</p>}
                    </CardContent>
                  </Card>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, subResources)}
                  >
                    <SortableContext items={subResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {subResources.map((r) => (
                          <ResourceCard
                            key={r.id}
                            resource={r}
                            canManage={!!canManage}
                            onDelete={(rid) => deleteResource.mutate(rid)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </TabsContent>
            );
          })}

          {/* Key Contacts tab */}
          <TabsContent value="Key Contacts" className="mt-4 space-y-4">
            <h3 className="font-semibold text-sm">Key Contacts — {specialty.short_name}</h3>
            {!contacts?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No contacts added yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {contacts.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={{
                      id: c.id,
                      name: c.name,
                      role: c.role,
                      organisation: c.organisation,
                      email: c.email,
                      phone: c.phone ?? undefined,
                      category: c.category,
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>

        {/* Discussion Board - always visible at bottom */}
        <div ref={discussionRef} className="pt-6 border-t">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold font-display">Discussion</h2>
          </div>
          <DiscussionBoard specialtyId={id!} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SpecialtyDetail;
