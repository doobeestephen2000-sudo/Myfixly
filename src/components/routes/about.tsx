import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Zap, Users, ShieldCheck, MapPin } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Myfixly" },
      { name: "description", content: "Myfixly links generator owners with verified professional mechanics across Nigeria." },
      { property: "og:title", content: "About Myfixly" },
      { property: "og:description", content: "Nigeria's marketplace for verified generator mechanics." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Power without the panic.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Myfixly is Nigeria's fastest way to find a trusted generator mechanic. We verify professionals, gather real reviews,
          and connect you directly on WhatsApp — no middlemen, no delays.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {[
            { icon: Users, title: "Built for Nigeria", body: "36 states covered, from Lagos to Kano. Local mechanics who understand your generator." },
            { icon: ShieldCheck, title: "Verified professionals", body: "Every mechanic completes ID verification and admin review before going live." },
            { icon: MapPin, title: "Nearby-first", body: "See who's closest and available. Google Maps directions built in." },
            { icon: Zap, title: "Instant contact", body: "Tap once to chat on WhatsApp or call. No forms, no waiting." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
