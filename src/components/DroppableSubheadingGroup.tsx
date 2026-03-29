import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SubheadingGroup } from "@/components/SubheadingGroup";
import { ResourceCard } from "@/components/ResourceCard";
import type { Tables } from "@/integrations/supabase/types";

interface DroppableSubheadingGroupProps {
  groupId: string;
  name: string;
  resources: Tables<"resources">[];
  canManage: boolean;
  onDelete: (id: string) => void;
  existingSubheadings: string[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function DroppableSubheadingGroup({
  groupId,
  name,
  resources,
  canManage,
  onDelete,
  existingSubheadings,
  selectable,
  selectedIds,
  onToggleSelect,
}: DroppableSubheadingGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${groupId}` });

  return (
    <SubheadingGroup
      name={name}
      resourceIds={resources.map((r) => r.id)}
      canManage={canManage}
    >
      <div
        ref={setNodeRef}
        className={`min-h-[40px] rounded-md transition-colors ${isOver ? "bg-accent/10 ring-1 ring-accent/30" : ""}`}
      >
        <SortableContext items={resources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {resources.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
              {isOver ? "Drop here" : "No resources yet — drag here or use \"Add Resource\""}
            </div>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  canManage={canManage}
                  onDelete={onDelete}
                  existingSubheadings={existingSubheadings}
                  selectable={selectable}
                  selected={selectedIds?.has(r.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </SubheadingGroup>
  );
}

interface DroppableUngroupedProps {
  resources: Tables<"resources">[];
  canManage: boolean;
  onDelete: (id: string) => void;
  existingSubheadings: string[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function DroppableUngrouped({
  resources,
  canManage,
  onDelete,
  existingSubheadings,
  selectable,
  selectedIds,
  onToggleSelect,
}: DroppableUngroupedProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "group:__ungrouped__" });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[20px] rounded-md transition-colors ${isOver ? "bg-accent/10 ring-1 ring-accent/30" : ""}`}
    >
      <SortableContext items={resources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              canManage={canManage}
              onDelete={onDelete}
              existingSubheadings={existingSubheadings}
              selectable={selectable}
              selected={selectedIds?.has(r.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
