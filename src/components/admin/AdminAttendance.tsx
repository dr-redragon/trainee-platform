import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ClipboardCheck } from "lucide-react";

export function AdminAttendance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" /> ENT Teaching Register
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The full Teaching Register (attendance, QR check-in, sessions, monitoring) opens in a separate page with its original design and functionality intact.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <a href="/teaching-register.html" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Open Teaching Register
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/teaching-register.html">
              Open in same tab
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
