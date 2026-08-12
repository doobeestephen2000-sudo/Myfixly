import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageSquare, Send } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — MyFixly" },
      { name: "description", content: "Get in touch with the MyFixly team." },
    ],
  }),
  component: Contact,
});

const SUPPORT_WHATSAPP = "+2348000000000";

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error("Please fill all fields.");
    const url = whatsappLink(SUPPORT_WHATSAPP, `Hi MyFixly — ${form.name} (${form.email})\n\n${form.message}`);
    if (url) window.open(url, "_blank");
    toast.success("Opening WhatsApp…");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold">Get in touch</h1>
        <p className="mt-3 text-muted-foreground">Questions, feedback, or need help with a listing? We're here.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div><Label>Your name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Message</Label><Textarea className="mt-1" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></div>
            <Button type="submit" className="w-full"><Send className="mr-2 h-4 w-4" />Send via WhatsApp</Button>
          </form>
          <aside className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="mt-2 font-display text-lg font-bold">WhatsApp support</h3>
              <p className="text-sm text-muted-foreground">Fastest way to reach us.</p>
              <p className="mt-2 text-sm font-medium">{SUPPORT_WHATSAPP}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="mt-2 font-display text-lg font-bold">Email</h3>
              <a className="text-sm text-muted-foreground hover:text-primary" href="mailto:hello@fixly.ng">hello@fixly.ng</a>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
