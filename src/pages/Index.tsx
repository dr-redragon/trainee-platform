import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Megaphone, FileText, Video, LinkIcon, BookOpen, CheckSquare, FolderOpen, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getIcon } from "@/lib/iconMap";
import { useCurrentUser } from "@/hooks/useUserRole";
import type { LucideIcon } from "lucide-react";

const typeIcons: Record<string, LucideIcon> = {
  pdf: FileText, video: Video, link: LinkIcon, document: BookOpen,
  checklist: CheckSquare, folder: FolderOpen, presentation: BookOpen,
};

const Index = () => {
  const { data: user } = useCurrentUser();

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
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ["active-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
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
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const firstName = profile?.first_name || "Trainee";

  // Group specialties: top-level and children
  const topLevel = specialties?.filter((s) => !(s as any).parent_specialty_id) ?? [];
  const childrenOf = (parentId: string) =>
    specialties?.filter((s) => (s as any).parent_specialty_id === parentId) ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold mb-1">Welcome back, {firstName}</h1>
          <p className="text-muted-foreground">Access your training resources and stay up to date.</p>
        </div>

        {/* Announcements */}
        {announcements?.map((a, i) => (
          <Card key={a.id} className="border-accent/30 bg-accent/5 animate-fade-in" style={{ animationDelay: `${0.05 * i + 0.1}s` }}>
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

        {/* Specialty cards */}
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
              {topLevel.map((s, i) => {
                const SIcon = getIcon(s.icon_name);
                const color = s.color ?? "174 60% 40%";
                const children = childrenOf(s.id);

                return (
                  <div key={s.id} className="animate-fade-in" style={{ animationDelay: `${0.05 * i + 0.15}s` }}>
                    {/* Parent card */}
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
                            <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">
                              {s.short_name}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">{s.name}</p>
                          </div>
                          {children.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {children.length} subspecialties
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        </CardContent>
                      </Card>
                    </Link>

                    {/* Subspecialty grid */}
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
                                  <h4 className="text-xs font-medium group-hover:text-accent transition-colors">
                                    {child.short_name}
                                  </h4>
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

        {/* Recent resources */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-4">Recently Added Resources</h2>
          {!recentResources?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No resources added yet.</p>
          ) : (
            <div className="space-y-2">
              {recentResources.map((r: any, i: number) => {
                const Icon = typeIcons[r.resource_type] || FileText;
                const specName = r.subsections?.specialties?.short_name ?? "";
                return (
                  <Card
                    key={r.id}
                    className="hover:shadow-sm transition-shadow animate-fade-in cursor-pointer"
                    style={{ animationDelay: `${0.05 * i + 0.4}s` }}
                  >
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
      </div>
    </DashboardLayout>
  );
};

export default Index;
