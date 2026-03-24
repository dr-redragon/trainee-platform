import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, Shield, ShieldOff, Trash2, Settings, UserCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type RoleName = "admin" | "facilitator" | "trainee";

const roleConfig: Record<RoleName, { label: string; icon: typeof Shield; color: string; description: string }> = {
  admin: { label: "Admin", icon: Shield, color: "text-destructive", description: "Full access to all content, users, and settings" },
  facilitator: { label: "Facilitator", icon: UserCheck, color: "text-accent", description: "Can add/remove resources for assigned specialties" },
  trainee: { label: "Trainee", icon: Eye, color: "text-muted-foreground", description: "View-only access to all resources" },
};

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleName>("trainee");
  const [permDialogUser, setPermDialogUser] = useState<Tables<"profiles"> | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleName>("trainee");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialties").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: facilitatorSpecs } = useQuery({
    queryKey: ["facilitator-specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facilitator_specialties").select("*");
      if (error) throw error;
      return data;
    },
  });

  const getUserRole = (userId: string): RoleName => {
    if (roles?.some((r) => r.user_id === userId && r.role === "admin")) return "admin";
    if (roles?.some((r) => r.user_id === userId && r.role === "facilitator")) return "facilitator";
    return "trainee";
  };

  const getUserFacilitatorSpecs = (userId: string) => {
    return facilitatorSpecs?.filter((fs) => fs.user_id === userId).map((fs) => fs.specialty_id) ?? [];
  };

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole, specialtyIds }: { userId: string; newRole: RoleName; specialtyIds: string[] }) => {
      // Remove all non-trainee roles first
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "trainee");
      if (delErr) throw delErr;

      // Remove all facilitator specialty assignments
      const { error: fsDelErr } = await supabase.from("facilitator_specialties").delete().eq("user_id", userId);
      if (fsDelErr) throw fsDelErr;

      // Add new role if not just trainee
      if (newRole === "admin") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      } else if (newRole === "facilitator") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "facilitator" });
        if (error) throw error;
        // Add specialty assignments
        if (specialtyIds.length > 0) {
          const { error: fsErr } = await supabase.from("facilitator_specialties").insert(
            specialtyIds.map((sid) => ({ user_id: userId, specialty_id: sid }))
          );
          if (fsErr) throw fsErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Permissions updated");
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["facilitator-specialties"] });
      setPermDialogUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: crypto.randomUUID().slice(0, 16) + "Aa1!",
        options: {
          data: { first_name: inviteFirst, last_name: inviteLast },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Role assignment happens after the trigger creates the profile
      if (inviteRole !== "trainee" && data.user) {
        // Small delay to let triggers fire
        await new Promise((r) => setTimeout(r, 500));
        if (inviteRole === "admin") {
          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
        } else if (inviteRole === "facilitator") {
          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "facilitator" });
        }
      }
    },
    onSuccess: () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      setInviteRole("trainee");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Delete profile (cascade will handle roles, bookmarks etc.)
      const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User removed");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPermissions = (profile: Tables<"profiles">) => {
    setPermDialogUser(profile);
    setSelectedRole(getUserRole(profile.user_id));
    setSelectedSpecialties(getUserFacilitatorSpecs(profile.user_id));
  };

  const toggleSpecialty = (specId: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specId) ? prev.filter((s) => s !== specId) : [...prev, specId]
    );
  };

  const filtered = profiles?.filter(
    (p) =>
      !search ||
      p.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(roleConfig) as [RoleName, typeof roleConfig.admin][]).map(([key, cfg]) => (
          <Card key={key} className="border-dashed">
            <CardContent className="p-3 flex items-center gap-3">
              <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
              <div>
                <p className="text-xs font-semibold">{cfg.label}</p>
                <p className="text-[10px] text-muted-foreground">{cfg.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite New User</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@nhs.net" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as RoleName)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainee">Trainee</SelectItem>
                    <SelectItem value="facilitator">Facilitator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => inviteUser.mutate()} disabled={!inviteEmail || inviteUser.isPending}>
                {inviteUser.isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Permissions dialog */}
      <Dialog open={!!permDialogUser} onOpenChange={(o) => { if (!o) setPermDialogUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions — {permDialogUser?.first_name} {permDialogUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleName)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trainee">
                    <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Trainee — View only</span>
                  </SelectItem>
                  <SelectItem value="facilitator">
                    <span className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5" /> Facilitator — Manage assigned specialties</span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Admin — Full access</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === "facilitator" && (
              <div className="space-y-2">
                <Label>Assigned Specialties</Label>
                <p className="text-xs text-muted-foreground">This facilitator can add/edit/delete resources only within these specialties:</p>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                  {specialties?.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                      <Checkbox
                        checked={selectedSpecialties.includes(s.id)}
                        onCheckedChange={() => toggleSpecialty(s.id)}
                      />
                      <span className="text-xs">{s.short_name}</span>
                    </label>
                  ))}
                </div>
                {selectedSpecialties.length === 0 && (
                  <p className="text-xs text-destructive">Select at least one specialty</p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => {
                if (permDialogUser) {
                  updateRole.mutate({
                    userId: permDialogUser.user_id,
                    newRole: selectedRole,
                    specialtyIds: selectedRole === "facilitator" ? selectedSpecialties : [],
                  });
                }
              }}
              disabled={updateRole.isPending || (selectedRole === "facilitator" && selectedSpecialties.length === 0)}
            >
              {updateRole.isPending ? "Saving…" : "Save Permissions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Specialties</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : !filtered?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
            ) : (
              filtered.map((p) => {
                const role = getUserRole(p.user_id);
                const cfg = roleConfig[role];
                const userFacSpecs = getUserFacilitatorSpecs(p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={role === "admin" ? "destructive" : role === "facilitator" ? "default" : "secondary"}
                        className="text-xs gap-1"
                      >
                        <cfg.icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {role === "facilitator" && userFacSpecs.length > 0
                        ? specialties?.filter((s) => userFacSpecs.includes(s.id)).map((s) => s.short_name).join(", ")
                        : role === "admin" ? "All" : "—"
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Manage permissions" onClick={() => openPermissions(p)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete user" onClick={() => deleteUser.mutate(p.user_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
