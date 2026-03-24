import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock, Megaphone, FileText, Video, LinkIcon, BookOpen, CheckSquare,
  FolderOpen, ChevronRight, Settings2, GripVertical, Eye, EyeOff, X, Columns2, Rows3,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIcon } from "@/lib/iconMap";
import { useCurrentUser } from "@/hooks/useUserRole";
import { useDashboardPreferences, type WidgetId } from "@/hooks/useDashboardPreferences";
import { BookmarksWidget } from "@/components/dashboard/BookmarksWidget";
import { WatchedDiscussionsWidget } from "@/components/dashboard/WatchedDiscussionsWidget";
import { StarredContactsWidget } from "@/components/dashboard/StarredContactsWidget";
import { SpecialtiesWidget } from "@/components/dashboard/SpecialtiesWidget";
import { RecentResourcesWidget } from "@/components/dashboard/RecentResourcesWidget";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, DragOverlay, type DragStartEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const WIDGET_LABELS: Record<WidgetId, string> = {
  announcements: "Announcements",
  specialties: "Your Specialties",
  bookmarks: "Bookmarked Resources",
  recent_resources: "Recently Added",
  watched_discussions: "Watched Discussions",
  contacts: "Key Contacts",
};

function SortableWidget({ id, children, isEditing }: { id: string; children: React.ReactNode; isEditing: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-8 top-4 cursor-grab text-muted-foreground hover:text-foreground z-10"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      {children}
    </div>
  );
}

const Index = () => {
  const { data: user } = useCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const { layout, hiddenWidgets, columns, rightColumnWidgets, savePrefs } = useDashboardPreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("first_name").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: announcements } = useQuery({
    queryKey: ["active-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements").select("*").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data;
    },
  });

  const firstName = profile?.first_name || "Trainee";

  // Compute visible widgets (excluding announcements and hidden)
  const allVisible = layout.filter((w) => !hiddenWidgets.includes(w) && w !== "announcements");

  // Split into left/right columns
  const leftColumn = allVisible.filter((w) => !rightColumnWidgets.includes(w));
  const rightColumn = allVisible.filter((w) => rightColumnWidgets.includes(w));

  // For single-column or non-editing mode with 1 col, use flat list
  const visibleWidgets = allVisible;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeWidget = active.id as WidgetId;
    const overWidget = over.id as WidgetId;

    if (columns === 2 && isEditing) {
      // Determine which column each is in
      const activeInRight = rightColumnWidgets.includes(activeWidget);
      const overInRight = rightColumnWidgets.includes(overWidget);
      const overIsDropzone = (overWidget as string) === "dropzone-left" || (overWidget as string) === "dropzone-right";

      if (overIsDropzone) {
        // Dropped on empty column dropzone
        const newRight = (overWidget as string) === "dropzone-right"
          ? [...rightColumnWidgets, activeWidget]
          : rightColumnWidgets.filter((w) => w !== activeWidget);
        savePrefs.mutate({ right_column_widgets: newRight });
        return;
      }

      if (activeInRight === overInRight) {
        // Same column — reorder within that column
        const col = activeInRight ? [...rightColumn] : [...leftColumn];
        const oldIdx = col.indexOf(activeWidget);
        const newIdx = col.indexOf(overWidget);
        const reordered = arrayMove(col, oldIdx, newIdx);

        // Rebuild full layout preserving order
        const newLayout = activeInRight
          ? [...leftColumn, ...reordered, ...hiddenWidgets]
          : [...reordered, ...rightColumn, ...hiddenWidgets];
        savePrefs.mutate({ widget_layout: newLayout });
      } else {
        // Cross-column move
        let newRight: WidgetId[];
        if (activeInRight) {
          // Moving from right to left
          newRight = rightColumnWidgets.filter((w) => w !== activeWidget);
        } else {
          // Moving from left to right
          newRight = [...rightColumnWidgets, activeWidget];
        }

        // Reorder: place active near over in the target column
        const targetCol = overInRight
          ? allVisible.filter((w) => newRight.includes(w))
          : allVisible.filter((w) => !newRight.includes(w));
        const overIdx = targetCol.indexOf(overWidget);
        const withoutActive = targetCol.filter((w) => w !== activeWidget);
        withoutActive.splice(overIdx, 0, activeWidget);

        const otherCol = overInRight
          ? allVisible.filter((w) => !newRight.includes(w) && w !== activeWidget)
          : allVisible.filter((w) => newRight.includes(w) && w !== activeWidget);

        const newLayout = [...(overInRight ? otherCol : withoutActive), ...(overInRight ? withoutActive : otherCol), ...hiddenWidgets];
        savePrefs.mutate({ widget_layout: newLayout, right_column_widgets: newRight });
      }
    } else {
      // Single column reorder
      const oldIndex = visibleWidgets.indexOf(activeWidget);
      const newIndex = visibleWidgets.indexOf(overWidget);
      const newOrder = arrayMove(visibleWidgets, oldIndex, newIndex);
      const fullLayout = [...newOrder, ...hiddenWidgets];
      savePrefs.mutate({ widget_layout: fullLayout });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Used for visual feedback — actual move happens on dragEnd
  };

  const toggleWidget = (widgetId: WidgetId) => {
    const newHidden = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter((w) => w !== widgetId)
      : [...hiddenWidgets, widgetId];
    savePrefs.mutate({ hidden_widgets: newHidden });
  };

  const renderWidget = (widgetId: WidgetId) => {
    switch (widgetId) {
      case "specialties":
        return <SpecialtiesWidget />;
      case "bookmarks":
        return <BookmarksWidget />;
      case "recent_resources":
        return <RecentResourcesWidget />;
      case "watched_discussions":
        return <WatchedDiscussionsWidget />;
      case "contacts":
        return <StarredContactsWidget />;
      default:
        return null;
    }
  };

  const renderEditCard = (widgetId: WidgetId) => (
    <SortableWidget key={widgetId} id={widgetId} isEditing>
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-3">
          <span className="text-sm font-medium">{WIDGET_LABELS[widgetId]}</span>
          <button
            onClick={() => toggleWidget(widgetId)}
            className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform"
          >
            <X className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    </SortableWidget>
  );

  const renderViewCard = (widgetId: WidgetId) => {
    const content = renderWidget(widgetId);
    if (!content) return null;
    return (
      <SortableWidget key={widgetId} id={widgetId} isEditing={false}>
        {content}
      </SortableWidget>
    );
  };

  const renderTwoColumnEditing = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pl-8">
      {/* Left column */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Left Column</p>
        <SortableContext items={leftColumn} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[60px] rounded-lg border-2 border-dashed border-muted p-2">
            {leftColumn.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Drag widgets here</p>
            )}
            {leftColumn.map((wId) => renderEditCard(wId))}
          </div>
        </SortableContext>
      </div>
      {/* Right column */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Right Column</p>
        <SortableContext items={rightColumn} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[60px] rounded-lg border-2 border-dashed border-muted p-2">
            {rightColumn.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Drag widgets here</p>
            )}
            {rightColumn.map((wId) => renderEditCard(wId))}
          </div>
        </SortableContext>
      </div>
    </div>
  );

  const renderTwoColumnView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <SortableContext items={leftColumn} strategy={verticalListSortingStrategy}>
          {leftColumn.map((wId) => renderViewCard(wId))}
        </SortableContext>
      </div>
      <div className="space-y-6">
        <SortableContext items={rightColumn} strategy={verticalListSortingStrategy}>
          {rightColumn.map((wId) => renderViewCard(wId))}
        </SortableContext>
      </div>
    </div>
  );

  const renderSingleColumn = () => (
    <SortableContext items={visibleWidgets} strategy={verticalListSortingStrategy}>
      <div className={isEditing ? "space-y-2 pl-8" : "space-y-6"}>
        {visibleWidgets.map((wId) => isEditing ? renderEditCard(wId) : renderViewCard(wId))}
      </div>
    </SortableContext>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome + Edit toggle */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">Welcome back, {firstName}</h1>
            <p className="text-muted-foreground">Access your training resources and stay up to date.</p>
          </div>
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="gap-2 shrink-0"
          >
            <Settings2 className="h-4 w-4" />
            {isEditing ? "Done Editing" : "Customise Dashboard"}
          </Button>
        </div>

        {/* Widget visibility toggles when editing */}
        {isEditing && (
          <Card className="border-primary/20 bg-primary/5 animate-fade-in">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Toggle widgets on or off, and drag to reorder{columns === 2 ? " between columns" : ""}:</p>
                <div className="flex items-center gap-1 border rounded-md p-0.5">
                  <Button
                    variant={columns === 1 ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 gap-1 text-xs"
                    onClick={() => savePrefs.mutate({ columns: 1 })}
                  >
                    <Rows3 className="h-3.5 w-3.5" /> 1 Column
                  </Button>
                  <Button
                    variant={columns === 2 ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 gap-1 text-xs"
                    onClick={() => savePrefs.mutate({ columns: 2 })}
                  >
                    <Columns2 className="h-3.5 w-3.5" /> 2 Columns
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WIDGET_LABELS) as WidgetId[]).filter((w) => w !== "announcements").map((wId) => {
                  const isHidden = hiddenWidgets.includes(wId);
                  return (
                    <Button
                      key={wId}
                      variant={isHidden ? "outline" : "secondary"}
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => toggleWidget(wId)}
                    >
                      {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {WIDGET_LABELS[wId]}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pinned Announcements — always at top */}
        {announcements?.length ? (
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id} className="border-accent/30 bg-accent/5">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Megaphone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{a.content}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">
                      {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Sortable widgets */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          {columns === 2
            ? (isEditing ? renderTwoColumnEditing() : renderTwoColumnView())
            : renderSingleColumn()
          }
          <DragOverlay>
            {activeId && isEditing ? (
              <Card className="border-dashed border-primary shadow-lg">
                <CardContent className="flex items-center justify-between p-3">
                  <span className="text-sm font-medium">{WIDGET_LABELS[activeId]}</span>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DashboardLayout>
  );
};

export default Index;
