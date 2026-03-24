import { Link } from "react-router-dom";
import { Clock, ArrowRight, Megaphone, BookOpen, FileText, Video, LinkIcon } from "lucide-react";
import { specialties } from "@/lib/specialties";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const recentResources = [
  { title: "FRCS Part A Revision Guide 2026", type: "PDF", specialty: "General Surgery", date: "22 Mar 2026" },
  { title: "Tympanoplasty Operative Technique", type: "Video", specialty: "ENT", date: "21 Mar 2026" },
  { title: "ATLS Course Registration", type: "Link", specialty: "Trauma & Orthopaedics", date: "20 Mar 2026" },
  { title: "Audit Proposal Template", type: "Document", specialty: "All Specialties", date: "19 Mar 2026" },
  { title: "Laparoscopic Skills Checklist", type: "Checklist", specialty: "General Surgery", date: "18 Mar 2026" },
];

const typeIcons: Record<string, typeof FileText> = {
  PDF: FileText,
  Video: Video,
  Link: LinkIcon,
  Document: FileText,
  Checklist: BookOpen,
};

const Index = () => {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold mb-1">Welcome back, Trainee</h1>
          <p className="text-muted-foreground">Access your training resources and stay up to date.</p>
        </div>

        {/* Announcement */}
        <Card className="border-accent/30 bg-accent/5 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
              <Megaphone className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Annual Review of Competence Progression (ARCP)</h3>
              <p className="text-sm text-muted-foreground">
                Reminder: ARCP submissions for the 2025/26 training year are due by 30 April 2026. Ensure your portfolio is up to date.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Specialty cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold">Your Specialties</h2>
            <Button variant="ghost" size="sm" className="text-accent text-xs">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {specialties.slice(0, 8).map((s, i) => (
              <Link key={s.id} to={`/specialty/${s.id}`}>
                <Card
                  className="group hover:shadow-md hover:border-accent/40 transition-all duration-200 cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${0.05 * i + 0.15}s` }}
                >
                  <CardContent className="p-5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `hsl(${s.color} / 0.12)` }}
                    >
                      <s.icon className="h-5 w-5" style={{ color: `hsl(${s.color})` }} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
                      {s.shortName}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{s.name}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent resources */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold">Recently Added Resources</h2>
          </div>
          <div className="space-y-2">
            {recentResources.map((r, i) => {
              const Icon = typeIcons[r.type] || FileText;
              return (
                <Card
                  key={i}
                  className="hover:shadow-sm transition-shadow animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${0.05 * i + 0.4}s` }}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{r.title}</h4>
                      <p className="text-xs text-muted-foreground">{r.specialty}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{r.type}</Badge>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {r.date}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
