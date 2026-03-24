import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, Search, ChevronDown, ChevronRight,
  BookOpen, LogOut, User, Shield
} from "lucide-react";
import { getIcon } from "@/lib/iconMap";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [specOpen, setSpecOpen] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const { data: role } = useUserRole();

  const { data: specialties } = useQuery({
    queryKey: ["sidebar-specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("id, short_name, icon_name, color, parent_specialty_id, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Separate top-level and children
  const topLevel = specialties?.filter((s) => !s.parent_specialty_id) ?? [];
  const childrenOf = (parentId: string) =>
    specialties?.filter((s) => s.parent_specialty_id === parentId) ?? [];

  const toggleParent = (id: string) =>
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <BookOpen className="h-5 w-5 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold font-display text-sidebar-accent-foreground tracking-tight">
                HST Training Hub
              </h1>
              <p className="text-[10px] text-sidebar-muted">NHS Higher Surgical Training</p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {!collapsed && (
          <div className="px-2 mb-3">
            <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-xs text-sidebar-muted">
              <Search className="h-3.5 w-3.5" />
              <span>Search resources…</span>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={specOpen} onOpenChange={setSpecOpen}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-accent-foreground transition-colors">
                <span>Specialties</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${specOpen ? "rotate-0" : "-rotate-90"}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {topLevel.map((s) => {
                    const SIcon = getIcon(s.icon_name);
                    const children = childrenOf(s.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedParents[s.id] ?? false;

                    if (!hasChildren) {
                      return (
                        <SidebarMenuItem key={s.id}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={`/specialty/${s.id}`}
                              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              className="text-xs"
                            >
                              <SIcon className="h-3.5 w-3.5" />
                              {!collapsed && <span>{s.short_name}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <div key={s.id}>
                        <SidebarMenuItem>
                          <div className="flex items-center w-full">
                            <SidebarMenuButton asChild className="flex-1">
                              <NavLink
                                to={`/specialty/${s.id}`}
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                className="text-xs"
                              >
                                <SIcon className="h-3.5 w-3.5" />
                                {!collapsed && <span>{s.short_name}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                            {!collapsed && (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleParent(s.id); }}
                                className="p-1 rounded hover:bg-sidebar-accent text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
                              >
                                <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            )}
                          </div>
                        </SidebarMenuItem>
                        {!collapsed && isExpanded && (
                          <div className="ml-4 pl-2 border-l border-sidebar-border">
                            {children.map((child) => {
                              const CIcon = getIcon(child.icon_name);
                              return (
                                <SidebarMenuItem key={child.id}>
                                  <SidebarMenuButton asChild>
                                    <NavLink
                                      to={`/specialty/${child.id}`}
                                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                      className="text-[11px]"
                                    >
                                      <CIcon className="h-3 w-3" />
                                      <span>{child.short_name}</span>
                                    </NavLink>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/contacts" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    <Users className="h-4 w-4" />
                    {!collapsed && <span>Key Contacts</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/profile" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    <User className="h-4 w-4" />
                    {!collapsed && <span>My Profile</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/login" className="text-sidebar-muted hover:text-sidebar-accent-foreground">
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="text-xs">Sign Out</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
