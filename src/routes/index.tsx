import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Wrench, Plug, Cog, Sparkles, ShieldCheck, MapPin, Star, Zap, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MechanicCard } from "@/components/mechanic-card";
import { NIGERIA_STATES, SERVICES, TRADES, MECHANIC_PUBLIC_COLUMNS } from "@/lib/constants";

const topRatedQuery = {
  queryKey: ["mechanics", "top-rated"],
  queryFn: async () => {
    const { data } = await supabase
      .from("mechanics")
      .select(MECHANIC_PUBLIC_COLUMNS)
      .eq("status", "approved")
      .order("rating_avg", { ascending: false })
      .order("rating_count", { ascending: false })
      .limit(6);
    return data ?? [];
  },
};

const recentQuery = {
  queryKey: ["mechanics", "recent"],
  queryFn: async () => {
    const { data } = await supabase
      .from("mechanics")
      .select(MECHANIC_PUBLIC_COLUMNS)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6);
    return data ?? [];
  },
};

const featuredQuery = {
  queryKey: ["mechanics", "featured"],
  queryFn: async () => {
    const { data } = await supabase
      .from("mechanics")
      .select(MECHANIC_PUBLIC_COLUMNS)
      .eq("status", "approved")
      .eq("featured", true)
      .limit(6);
    return data ?? [];
  },
};

const statsQuery = {
  queryKey: ["stats", "home"],
  queryFn: async () => {
    const { count: mechanics } = await supabase
      .from("mechanics")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    const { count: verified } = await supabase
      .from("mechanics")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("verified", true);
    return { mechanics: mechanics ?? 0, verified: verified ?? 0 };
  },
};

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth" });
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if ((roles ?? []).some((role) => role.role === "admin")) {
      throw redirect({ to: "/admin" });
    }

    throw redirect({ to: "/dashboard" });
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(topRatedQuery);
    void context.queryClient.prefetchQuery(recentQuery);
    void context.queryClient.prefetchQuery(featuredQuery);
    void context.queryClient.prefetchQuery(statsQuery);
  },
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const { data: topRated = [] } = useQuery(topRatedQuery);
  const { data: recent = [] } = useQuery(recentQuery);
  const { data: featured = [] } = useQuery(featuredQuery);
  const { data: stats } = useSuspenseQuery(statsQuery);

  const iconMap = { wrench: Wrench, plug: Plug, cog: Cog, sparkles: Sparkles };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-subtle">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-primary-glow/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified artisans across Nigeria
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
              Find a trusted mechanic, plumber or artisan <span className="text-primary">near you</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Generator mechanics, plumbers, electricians, carpenters, AC techs and more — verified profiles, real reviews, and secure service requests.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/mechanics", search: { q: q || undefined, state: state || undefined } as never });
              }}
              className="mx-auto mt-8 grid max-w-2xl gap-2 rounded-2xl border border-border bg-card p-2 shadow-elegant sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search services or mechanics"
                  className="h-12 min-w-0 border-0 pl-9 shadow-none focus-visible:ring-0"
                />
              </div>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-12 rounded-md border border-input/60 bg-background px-3 text-sm focus:outline-none sm:border-0 sm:bg-transparent"
              >
                <option value="">All states</option>
                {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button type="submit" size="lg" className="h-12 shadow-elegant">Search</Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> <b className="text-foreground">{stats.mechanics}</b> pros</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> <b className="text-foreground">{stats.verified}</b> verified</div>
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-warning" /> Rated & reviewed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trades */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Browse by trade" title="Skilled pros for every job" />
        <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TRADES.filter((t) => t.key !== "other").map((t) => (
            <Link
              key={t.key}
              to="/mechanics"
              search={{ trade: t.key } as never}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold">{t.label}</p>
                <p className="truncate text-xs text-muted-foreground">Verified {t.label.toLowerCase()}s</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="What we cover" title="Repair, install, maintain, service" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => {
            const Icon = iconMap[s.icon as keyof typeof iconMap];
            return (
              <Link
                key={s.key}
                to="/mechanics"
                search={{ service: s.key } as never}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{s.label}</h3>
                <p className="text-sm text-muted-foreground">Book a certified pro for {s.label.toLowerCase()}.</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Browse pros <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Featured" title="Featured mechanics" cta />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((m) => <MechanicCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {/* Top Rated */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Highly rated" title="Top-rated mechanics" cta />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topRated.length === 0 ? (
            <EmptyState />
          ) : topRated.map((m) => <MechanicCard key={m.id} m={m} />)}
        </div>
      </section>

      {/* Recently joined */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Fresh talent" title="Recently joined" cta />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((m) => <MechanicCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero px-6 py-14 text-center text-primary-foreground shadow-elegant sm:px-12">
          <div className="absolute inset-0 -z-10 opacity-20">
            <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-white/40 blur-3xl" />
          </div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Are you a skilled artisan?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/90 sm:text-base">
            Whether you're a mechanic, plumber, electrician or any skilled pro — join Myfixly and reach thousands of customers.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="shadow-elegant">
              <Link to="/auth" search={{ mode: "signup" } as never}>Create your profile</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <Link to="/about"><MapPin className="mr-2 h-4 w-4" /> How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, cta }: { eyebrow: string; title: string; cta?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      </div>
      {cta && (
        <Link to="/mechanics" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
        <Zap className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">No pros yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Be the first to join — sign up as an artisan today.</p>
      <Button asChild className="mt-4"><Link to="/auth" search={{ mode: "signup" } as never}>Register as a pro</Link></Button>
    </div>
  );
}
