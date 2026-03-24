import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Megaphone, FileText, Video, LinkIcon, BookOpen, CheckSquare, FolderOpen } from "lucide-react";
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

  // Specialties the user can access (RLS enforced)
  const { data: specialties } = useQuery({
    queryKey: ["my-specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialties").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Active announcements
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

  // Recent resources (across all accessible subsections)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {specialties.map((s, i) => {
                const SIcon = getIcon(s.icon_name);
                const color = s.color ?? "174 60% 40%";
                return (
                  <Link key={s.id} to={`/specialty/${s.id}`}>
                    <Card
                      className="group hover:shadow-md hover:border-accent/40 transition-all duration-200 cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${0.05 * i + 0.15}s` }}
                    >
                      <CardContent className="p-5">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg mb-3 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `hsl(${color} / 0.12)` }}
                        >
                          <SIcon className="h-5 w-5" style={{ color: `hsl(${color})` }} />
                        </div>
                        <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
                          {s.short_name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{s.name}</p>
                      </CardContent>
                    </Card>
                  </Link>
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
