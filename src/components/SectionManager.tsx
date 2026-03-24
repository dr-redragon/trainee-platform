import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface SectionManagerProps {
  specialtyId: string;
  subsections: Tables<"subsections">[];
}

function SortableSection({
  section,
  onRename,
  onDelete,
}: {
  section: Tables<"subsections">;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (name.trim() && name.trim() !== section.name) {
      onRename(section.id, name.trim());
    }
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="h-7 text-sm flex-1"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm">{section.name}</span>
      )}
      <button onClick={() => { setEditing(true); setName(section.name); }} className="text-muted-foreground hover:text-foreground">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => onDelete(section.id)} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SectionManager({ specialtyId, subsections }: SectionManagerProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const renameSection = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("subsections").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section renamed");
      queryClient.invalidateQueries({ queryKey: ["subsections", specialtyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderSections = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const u of updates) {
        await supabase.from("subsections").update({ sort_order: u.sort_order }).eq("id", u.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subsections", specialtyId] }),
  });

  const addSection = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = Math.max(0, ...subsections.map((s) => s.sort_order ?? 0));
      const { error } = await supabase.from("subsections").insert({
        specialty_id: specialtyId,
        name,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section added");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["subsections", specialtyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subsections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section deleted");
      queryClient.invalidateQueries({ queryKey: ["subsections", specialtyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subsections.findIndex((s) => s.id === active.id);
    const newIndex = subsections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(subsections, oldIndex, newIndex);
    const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
    // Optimistic update
    queryClient.setQueryData(["subsections", specialtyId], reordered.map((s, i) => ({ ...s, sort_order: i })));
    reorderSections.mutate(updates);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Manage Sections
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Sections</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={subsections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {subsections.map((s) => (
                <SortableSection
                  key={s.id}
                  section={s}
                  onRename={(id, name) => renameSection.mutate({ id, name })}
                  onDelete={(id) => deleteSection.mutate(id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="New section name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && addSection.mutate(newName.trim())}
            className="text-sm h-8"
          />
          <Button
            size="sm"
            onClick={() => newName.trim() && addSection.mutate(newName.trim())}
            disabled={!newName.trim()}
            className="gap-1 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
