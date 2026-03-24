import { useState } from "react";
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
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LucideIcon } from "lucide-react";

const typeIcons: Record<string, LucideIcon> = {
  pdf: FileText, video: Video, link: LinkIcon, document: BookOpen,
  checklist: CheckSquare, folder: FolderOpen, presentation: BookOpen,
};

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
    opacity: isDragging ? 0.5 : 1,
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
  const { layout, hiddenWidgets, columns, savePrefs } = useDashboardPreferences();

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

  const { data: specialties } = useQuery({
    queryKey: ["my-specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialties").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
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

  const { data: recentResources } = useQuery({
    queryKey: ["recent-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*, subsections!inner(specialty_id, specialties!inner(short_name))")
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const firstName = profile?.first_name || "Trainee";
  const topLevel = specialties?.filter((s) => !(s as any).parent_specialty_id) ?? [];
  const childrenOf = (parentId: string) =>
    specialties?.filter((s) => (s as any).parent_specialty_id === parentId) ?? [];

  const visibleWidgets = layout.filter((w) => !hiddenWidgets.includes(w) && w !== "announcements");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleWidgets.indexOf(active.id as WidgetId);
    const newIndex = visibleWidgets.indexOf(over.id as WidgetId);
    const newOrder = arrayMove(visibleWidgets, oldIndex, newIndex);
    // Keep hidden widgets at end
    const fullLayout = [...newOrder, ...hiddenWidgets];
    savePrefs.mutate({ widget_layout: fullLayout });
  };

  const toggleWidget = (widgetId: WidgetId) => {
    const newHidden = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter((w) => w !== widgetId)
      : [...hiddenWidgets, widgetId];
    savePrefs.mutate({ hidden_widgets: newHidden });
  };

  const renderWidget = (widgetId: WidgetId) => {
    switch (widgetId) {
      case "announcements":
        if (!announcements?.length) return null;
        return (
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id} className="border-accent/30 bg-accent/5">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                    <Megaphone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">{a.content}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case "specialties":
        return (
          <div>
            <h2 className="text-lg font-display font-semibold mb-4">Your Specialties</h2>
            {!specialties?.length ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No specialties assigned yet. Contact your administrator.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {topLevel.map((s) => {
                  const SIcon = getIcon(s.icon_name);
                  const color = s.color ?? "174 60% 40%";
                  const children = childrenOf(s.id);
                  return (
                    <div key={s.id}>
                      <Link to={`/specialty/${s.id}`}>
                        <Card className="group hover:shadow-md hover:border-accent/40 transition-all duration-200 cursor-pointer mb-3">
                          <CardContent className="p-5 flex items-center gap-4">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                              style={{ backgroundColor: `hsl(${color} / 0.12)` }}
                            >
                              <SIcon className="h-5 w-5" style={{ color: `hsl(${color})` }} />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">{s.short_name}</h3>
                              <p className="text-xs text-muted-foreground line-clamp-1">{s.name}</p>
                            </div>
                            {children.length > 0 && (
                              <Badge variant="secondary" className="text-[10px]">{children.length} subspecialties</Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                          </CardContent>
                        </Card>
                      </Link>
                      {children.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ml-6 pl-4 border-l-2 border-muted">
                          {children.map((child) => {
                            const CIcon = getIcon(child.icon_name);
                            const cColor = child.color ?? "174 60% 40%";
                            return (
                              <Link key={child.id} to={`/specialty/${child.id}`}>
                                <Card className="group hover:shadow-sm hover:border-accent/30 transition-all duration-200 cursor-pointer">
                                  <CardContent className="p-4">
                                    <div
                                      className="flex h-8 w-8 items-center justify-center rounded-md mb-2 transition-transform group-hover:scale-110"
                                      style={{ backgroundColor: `hsl(${cColor} / 0.12)` }}
                                    >
                                      <CIcon className="h-4 w-4" style={{ color: `hsl(${cColor})` }} />
                                    </div>
                                    <h4 className="text-xs font-medium group-hover:text-accent transition-colors">{child.short_name}</h4>
                                  </CardContent>
                                </Card>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "bookmarks":
        return <BookmarksWidget />;

      case "recent_resources":
        return (
          <div>
            <h2 className="text-lg font-display font-semibold mb-4">Recently Added Resources</h2>
            {!recentResources?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No resources added yet.</p>
            ) : (
              <div className="space-y-2">
                {recentResources.map((r: any) => {
                  const Icon = typeIcons[r.resource_type] || FileText;
                  const specName = r.subsections?.specialties?.short_name ?? "";
                  return (
                    <Card key={r.id} className="hover:shadow-sm transition-shadow cursor-pointer">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">{r.title}</h4>
                          <p className="text-xs text-muted-foreground">{specName}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{r.resource_type.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "watched_discussions":
        return <WatchedDiscussionsWidget />;

      case "contacts":
        return <StarredContactsWidget />;

      default:
        return null;
    }
  };

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
                <p className="text-sm font-medium">Toggle widgets on or off, and drag to reorder:</p>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleWidgets} strategy={verticalListSortingStrategy}>
            <div className={`${isEditing ? "space-y-2 pl-8" : columns === 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-6"}`}>
              {visibleWidgets.map((widgetId) => {
                if (isEditing) {
                  return (
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
                }
                const content = renderWidget(widgetId);
                if (!content) return null;
                return (
                  <SortableWidget key={widgetId} id={widgetId} isEditing={false}>
                    {content}
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </DashboardLayout>
  );
};

export default Index;
