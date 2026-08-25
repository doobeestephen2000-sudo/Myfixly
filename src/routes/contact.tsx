import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Globe, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error("Please fill all fields.");
    window.open("https://myfixly.ng", "_blank", "noopener,noreferrer");
    toast.success("Opening myfixly.ng to continue your enquiry.");
  }
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8"><h1 className="font-display text-4xl font-bold">Get in touch</h1><p className="mt-3 text-muted-foreground">Contact Myfixly for general enquiries, customer complaints, support issues, or questions about Myfixly.</p><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]"><form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"><div><Label>Your name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div><div><Label>Message</Label><Textarea className="mt-1" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></div><Button type="submit" className="w-full"><Send className="mr-2 h-4 w-4" />Continue at myfixly.ng</Button></form><aside><div className="rounded-2xl border border-border bg-card p-6 shadow-soft"><Globe className="h-5 w-5 text-primary" /><h3 className="mt-2 font-display text-lg font-bold">Myfixly support</h3><a className="mt-2 block text-sm font-medium text-primary hover:underline" href="https://myfixly.ng" target="_blank" rel="noreferrer">myfixly.ng</a></div></aside></div></main>;
}
