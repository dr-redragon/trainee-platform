import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { specialties, defaultSubsections } from "@/lib/specialties";
import { sampleContacts } from "@/lib/contacts";
import { ContactCard } from "@/components/ContactCard";
import { DiscussionBoard } from "@/components/DiscussionBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Video, LinkIcon, BookOpen, CheckSquare, FolderOpen, Plus, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const resourceTypeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  video: Video,
  link: LinkIcon,
  document: BookOpen,
  checklist: CheckSquare,
  folder: FolderOpen,
};

const sampleResources = [
  { title: "Specialty Curriculum 2025-26", type: "pdf", desc: "Latest curriculum from the Royal College", date: "15 Mar 2026", author: "Admin" },
  { title: "Core Skills Assessment Guide", type: "document", desc: "Assessment criteria and marking rubric", date: "10 Mar 2026", author: "TPD Office" },
  { title: "Operative Technique — Introduction", type: "video", desc: "Introductory video covering basic operative setup", date: "8 Mar 2026", author: "Mr J. Smith" },
  { title: "NICE Guidelines — Quick Reference", type: "link", desc: "Link to relevant NICE clinical guidelines", date: "5 Mar 2026", author: "Admin" },
];

const allTabs = [...defaultSubsections, "Key Contacts", "Discussion"];

const SpecialtyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const specialty = specialties.find((s) => s.id === id);

  if (!specialty) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Specialty not found.
        </div>
      </DashboardLayout>
    );
  }

  const specialtyContacts = sampleContacts.filter(
    (c) => c.specialtyId === id || !c.specialtyId
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `hsl(${specialty.color} / 0.12)` }}
          >
            <specialty.icon className="h-6 w-6" style={{ color: `hsl(${specialty.color})` }} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">{specialty.shortName}</h1>
            <p className="text-sm text-muted-foreground">{specialty.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultSubsections[0]} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-secondary/50 p-1">
            {allTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs whitespace-nowrap">
                {tab === "Key Contacts" && <Users className="h-3 w-3 mr-1" />}
                {tab === "Discussion" && <MessageSquare className="h-3 w-3 mr-1" />}
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Resource subsections */}
          {defaultSubsections.map((sub) => (
            <TabsContent key={sub} value={sub} className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{sub}</h3>
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Resource
                </Button>
              </div>
              {sampleResources.map((r, i) => {
                const Icon = resourceTypeIcons[r.type] || FileText;
                return (
                  <Card key={i} className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium">{r.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{r.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-[10px] mb-1">{r.type.toUpperCase()}</Badge>
                        <p className="text-[10px] text-muted-foreground">{r.date}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}

          {/* Key Contacts tab */}
          <TabsContent value="Key Contacts" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Key Contacts — {specialty.shortName}</h3>
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Contact
              </Button>
            </div>
            {specialtyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No contacts added yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {specialtyContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Discussion tab */}
          <TabsContent value="Discussion" className="mt-4">
            <DiscussionBoard specialtyId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SpecialtyDetail;
