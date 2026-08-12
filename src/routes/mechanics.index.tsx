import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search, SlidersHorizontal, X, MapPinned, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MechanicCard } from "@/components/mechanic-card";
import { NIGERIA_STATES, SERVICES, TRADES, MECHANIC_PUBLIC_COLUMNS } from "@/lib/constants";

const searchSchema = z.object({
  q: z.string().optional(),
  trade: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  brand: z.string().optional(),
  service: z.string().optional(),
});

export const Route = createFileRoute("/mechanics/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Find Skilled Artisans & Mechanics — MyFixly" },
      { name: "description", content: "Search verified plumbers, electricians, generator mechanics, carpenters and other skilled artisans across Nigeria." },
      { property: "og:title", content: "Find verified artisans in Nigeria" },
      { property: "og:description", content: "Browse verified profiles, reviews and contact skilled pros directly on WhatsApp." },
    ],
  }),
  component: MechanicsList,
});

function MechanicsList() {
  const initial = Route.useSearch();
  const [filters, setFilters] = useState({
    q: initial.q ?? "",
    trade: initial.trade ?? "",
    state: initial.state ?? "",
    city: initial.city ?? "",
    service: initial.service ?? "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: mechanics = [], isLoading } = useQuery({
    queryKey: ["mechanics", "search", filters],
    queryFn: async () => {
      let q = supabase.from("mechanics").select(MECHANIC_PUBLIC_COLUMNS).eq("status", "approved");
      if (filters.trade) q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq("trade", filters.trade);
      if (filters.state) q = q.eq("state", filters.state);
      if (filters.city) q = q.ilike("city", `%${filters.city}%`);
      if (filters.service) q = q.contains("services", [filters.service]);
      const { data } = await q.order("verified", { ascending: false }).order("rating_avg", { ascending: false }).limit(60);
      return (data ?? []) as unknown as Array<Parameters<typeof MechanicCard>[0]["m"]>;
    },
  });

  const filtered = useMemo(() => {
    if (!filters.q.trim()) return mechanics;
    const term = filters.q.toLowerCase();
    return mechanics.filter((m) =>
      m.full_name.toLowerCase().includes(term) ||
      (m.business_name ?? "").toLowerCase().includes(term) ||
      m.services.some((s) => s.toLowerCase().includes(term)) ||
      m.city.toLowerCase().includes(term)
    );
  }, [mechanics, filters.q]);

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Find your pro</h1>
        <p className="mt-2 text-muted-foreground">Browse and contact verified mechanics, plumbers, electricians and other skilled artisans across Nigeria.</p>
      </div>

      <div className="sticky top-16 z-30 -mx-4 mb-6 border-y border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:p-3 sm:shadow-card">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search name, service, or city" className="h-11 min-w-0 pl-9" />
          </div>
          <select value={filters.trade} onChange={(e) => setFilters({ ...filters, trade: e.target.value })} className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All trades</option>
            {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <Button variant="outline" className="h-11" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters {activeCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span>}
          </Button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All states</option>
              {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} placeholder="City / area" />
            <select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All services</option>
              {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {activeCount > 0 && (
              <Button variant="ghost" onClick={() => setFilters({ q: "", trade: "", state: "", city: "", service: "" })} className="justify-start text-muted-foreground">
                <X className="mr-2 h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-primary/25 bg-gradient-subtle px-5 py-12 text-center sm:px-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-soft"><MapPinned className="h-8 w-8" /></div>
          <h3 className="mt-5 font-display text-xl font-semibold">No pros found in this search</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a nearby city, choose another trade, or clear your filters to see all verified artisans.</p>
          <Button asChild className="mt-6 shadow-elegant"><Link to="/mechanics"><RotateCcw className="h-4 w-4" />Reset search</Link></Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{filtered.length} pro{filtered.length === 1 ? "" : "s"} found</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => <MechanicCard key={m.id} m={m} />)}
          </div>
        </>
      )}
    </div>
  );
}
