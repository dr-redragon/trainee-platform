import { useState } from "react";
import { Mail, Send, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ContactForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("contact-form-email", {
        body: { name, email, message },
      });

      if (error) throw error;

      toast.success("Message sent! Check your inbox for a confirmation.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="border-t bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="max-w-xl mx-auto text-center mb-10">
          <h2 className="text-2xl font-display font-bold mb-3">Get in Touch</h2>
          <p className="text-muted-foreground">
            Have a question or suggestion? Send us a message and we'll get back to you.
          </p>
        </div>
        <Card className="max-w-lg mx-auto border-border/60 shadow-md">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Your name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact-name"
                    placeholder="Dr Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="name@nhs.net"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-message">Message</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="contact-message"
                    placeholder="How can we help?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="pl-10 min-h-[120px]"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSending}>
                {isSending ? "Sending…" : "Send Message"}
                {!isSending && <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ContactForm;
