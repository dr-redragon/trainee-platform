import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Plus, Trash2, Users, CheckCircle2, XCircle, Clock, ShieldCheck, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useUserRole } from "@/hooks/useUserRole";
import { useDeanery } from "@/contexts/DeaneryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Status = "present" | "absent" | "late" | "excused";

interface Session {
  id: string;
  title: string;
  session_date: string;
  location: string | null;
  notes: string | null;
  specialty_id: string | null;
  deanery_id: string | null;
}

interface Trainee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  training_grade: string | null;
}

interface Record {
  id: string;
  session_id: string;
  user_id: string;
  status: Status;
  notes: string | null;
}

const STATUS_META: Record_<Status, { label: string; icon: typeof CheckCircle2; className: string }> = {
  present: { label: "Present", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/30" },
  absent: { label: "Absent", icon: XCircle, className: "bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-500/30" },
  late: { label: "Late", icon: Clock, className: "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30" },
  excused: { label: "Excused", icon: ShieldCheck, className: "bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 border-sky-500/30" },
};
type Record_<K extends string, V> = { [P in K]: V };

const STATUS_ORDER: Status[] = ["present", "late", "excused", "absent"];

export function AdminAttendance() {
  const { data: user } = useCurrentUser();
  const { data: role } = useUserRole();
  const { activeDeanery } = useDeanery();
  const canManage = role === "admin" || role === "super_admin" || role === "facilitator";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // New session form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const deaneryId = currentDeanery?.id;

  async function loadAll() {
    if (!deaneryId) return;
    setLoading(true);
    const [{ data: sess }, { data: profs }] = await Promise.all([
      supabase.from("teaching_sessions").select("*").eq("deanery_id", deaneryId).order("session_date", { ascending: false }),
      supabase.from("profiles").select("user_id, first_name, last_name, email, training_grade").eq("deanery_id", deaneryId).order("last_name"),
    ]);
    setSessions((sess as Session[]) ?? []);
    setTrainees((profs as Trainee[]) ?? []);
    if (sess && sess.length && !activeSessionId) setActiveSessionId(sess[0].id);
    setLoading(false);
  }

  async function loadRecords() {
    const ids = sessions.map((s) => s.id);
    if (!ids.length) { setRecords([]); return; }
    const { data } = await supabase.from("attendance_records").select("*").in("session_id", ids);
    setRecords((data as Record[]) ?? []);
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [deaneryId]);
  useEffect(() => { loadRecords(); /* eslint-disable-next-line */ }, [sessions]);

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) ?? null, [sessions, activeSessionId]);

  const recordsForActive = useMemo(() => {
    const map = new Map<string, Record>();
    records.filter((r) => r.session_id === activeSessionId).forEach((r) => map.set(r.user_id, r));
    return map;
  }, [records, activeSessionId]);

  const filteredTrainees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter((t) =>
      `${t.first_name} ${t.last_name} ${t.email}`.toLowerCase().includes(q),
    );
  }, [trainees, search]);

  const stats = useMemo(() => {
    const counts: Record_<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    recordsForActive.forEach((r) => { counts[r.status]++; });
    const marked = counts.present + counts.absent + counts.late + counts.excused;
    return { ...counts, marked, total: trainees.length };
  }, [recordsForActive, trainees]);

  async function createSession() {
    if (!newTitle.trim() || !newDate || !deaneryId || !user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("teaching_sessions")
      .insert({
        title: newTitle.trim(),
        session_date: format(newDate, "yyyy-MM-dd"),
        location: newLocation.trim() || null,
        deanery_id: deaneryId,
        created_by: user.id,
      })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Session created");
    setNewTitle(""); setNewLocation(""); setNewDate(new Date());
    setSessions((s) => [data as Session, ...s]);
    setActiveSessionId((data as Session).id);
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from("teaching_sessions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Session deleted");
    setSessions((s) => s.filter((x) => x.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }

  async function setStatus(userId: string, status: Status) {
    if (!activeSessionId || !user) return;
    const existing = recordsForActive.get(userId);
    if (existing) {
      const { data, error } = await supabase
        .from("attendance_records")
        .update({ status, marked_by: user.id })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      setRecords((rs) => rs.map((r) => (r.id === existing.id ? (data as Record) : r)));
    } else {
      const { data, error } = await supabase
        .from("attendance_records")
        .insert({ session_id: activeSessionId, user_id: userId, status, marked_by: user.id })
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      setRecords((rs) => [...rs, data as Record]);
    }
  }

  async function clearStatus(userId: string) {
    const existing = recordsForActive.get(userId);
    if (!existing) return;
    const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
    if (error) { toast.error(error.message); return; }
    setRecords((rs) => rs.filter((r) => r.id !== existing.id));
  }

  async function markAll(status: Status) {
    if (!activeSessionId || !user) return;
    const rows = trainees.map((t) => ({
      session_id: activeSessionId,
      user_id: t.user_id,
      status,
      marked_by: user.id,
    }));
    const { error } = await supabase
      .from("attendance_records")
      .upsert(rows, { onConflict: "session_id,user_id" });
    if (error) { toast.error(error.message); return; }
    toast.success(`All marked ${status}`);
    loadRecords();
  }

  // Monitor view — attendance rate per trainee across all sessions
  const monitor = useMemo(() => {
    const totalSessions = sessions.length;
    return trainees
      .map((t) => {
        const userRecs = records.filter((r) => r.user_id === t.user_id);
        const present = userRecs.filter((r) => r.status === "present" || r.status === "late").length;
        const excused = userRecs.filter((r) => r.status === "excused").length;
        const absent = userRecs.filter((r) => r.status === "absent").length;
        const denom = totalSessions - excused;
        const rate = denom > 0 ? Math.round((present / denom) * 100) : 0;
        return { trainee: t, present, absent, excused, rate, denom };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [trainees, records, sessions]);

  if (!canManage) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">You don't have permission to manage attendance.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="mark" className="w-full">
        <TabsList>
          <TabsTrigger value="mark">Mark attendance</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        {/* MARK ATTENDANCE */}
        <TabsContent value="mark" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Active session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[240px]">
                  <Label className="text-xs">Session</Label>
                  <Select value={activeSessionId ?? ""} onValueChange={setActiveSessionId}>
                    <SelectTrigger><SelectValue placeholder={sessions.length ? "Pick a session" : "Create a session first"} /></SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {format(parseISO(s.session_date), "d MMM yyyy")} — {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeSession && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => markAll("present")}>Mark all present</Button>
                    <Button size="sm" variant="outline" onClick={() => markAll("absent")}>Mark all absent</Button>
                  </div>
                )}
              </div>

              {activeSession && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Stat label="Trainees" value={stats.total} />
                  <Stat label="Present" value={stats.present} className="text-emerald-600" />
                  <Stat label="Late" value={stats.late} className="text-amber-600" />
                  <Stat label="Excused" value={stats.excused} className="text-sky-600" />
                  <Stat label="Absent" value={stats.absent} className="text-red-600" />
                </div>
              )}
            </CardContent>
          </Card>

          {activeSession && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">Roster — {format(parseISO(activeSession.session_date), "d MMM yyyy")}</CardTitle>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trainees…" className="pl-8 w-64" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                ) : filteredTrainees.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No trainees in this deanery.</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTrainees.map((t) => {
                      const current = recordsForActive.get(t.user_id);
                      return (
                        <div key={t.user_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/30 transition">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{t.first_name} {t.last_name}</div>
                            <div className="text-xs text-muted-foreground truncate">{t.email}{t.training_grade ? ` · ${t.training_grade}` : ""}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {STATUS_ORDER.map((s) => {
                              const meta = STATUS_META[s];
                              const Icon = meta.icon;
                              const active = current?.status === s;
                              return (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => active ? clearStatus(t.user_id) : setStatus(t.user_id, s)}
                                  className={cn("h-8 px-2 gap-1 text-xs", active && meta.className)}
                                  title={meta.label}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">{meta.label}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SESSIONS */}
        <TabsContent value="sessions" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Create monthly session</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Title</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Paediatric ENT teaching" />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start font-normal", !newDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDate ? format(newDate, "d MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newDate} onSelect={setNewDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs">Location (optional)</Label>
                  <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. LGI Seminar Room" />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={createSession} disabled={creating || !newTitle.trim() || !newDate}>
                  <Plus className="h-4 w-4 mr-1" /> Add session
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">All sessions</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Marked</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sessions yet.</TableCell></TableRow>
                  ) : sessions.map((s) => {
                    const marked = records.filter((r) => r.session_id === s.id).length;
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => setActiveSessionId(s.id)}>
                        <TableCell className="font-medium whitespace-nowrap">{format(parseISO(s.session_date), "d MMM yyyy")}</TableCell>
                        <TableCell>{s.title}</TableCell>
                        <TableCell className="text-muted-foreground">{s.location ?? "—"}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{marked}/{trainees.length}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete session?</AlertDialogTitle>
                                <AlertDialogDescription>This will also remove all attendance records for "{s.title}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSession(s.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONITOR */}
        <TabsContent value="monitor" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attendance summary</CardTitle>
              <p className="text-xs text-muted-foreground">
                Rate = (present + late) ÷ (total sessions − excused). Across {sessions.length} session{sessions.length === 1 ? "" : "s"}.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Excused</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-right">Adjusted rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitor.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No trainees.</TableCell></TableRow>
                  ) : monitor.map(({ trainee, present, excused, absent, rate, denom }) => (
                    <TableRow key={trainee.user_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{trainee.first_name} {trainee.last_name}</div>
                        <div className="text-xs text-muted-foreground">{trainee.training_grade ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-center">{present}</TableCell>
                      <TableCell className="text-center">{excused}</TableCell>
                      <TableCell className="text-center">{absent}</TableCell>
                      <TableCell className="text-right">
                        {denom > 0 ? (
                          <Badge className={cn(
                            rate >= 80 ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                              : rate >= 60 ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                              : "bg-red-500/15 text-red-700 border-red-500/30",
                          )} variant="outline">{rate}%</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className={cn("text-2xl font-bold", className)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
