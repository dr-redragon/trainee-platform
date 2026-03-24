import { Mail, Phone, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Contact, contactCategories, obfuscateEmail } from "@/lib/contacts";

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  const category = contactCategories.find((c) => c.key === contact.category);
  const Icon = category?.icon ?? Mail;

  return (
    <Card className="hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{contact.name}</h3>
                <p className="text-xs text-muted-foreground">{contact.role}</p>
              </div>
              {category && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {category.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/50" />
              {contact.organisation}
            </p>
            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {obfuscateEmail(contact.email)}
              </span>
              {contact.phone && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
