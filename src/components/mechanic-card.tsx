import { Link } from "@tanstack/react-router";
import { MapPin, Star, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { artisanTradeLabel } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type MechanicRow = Database["public"]["Tables"]["mechanics"]["Row"];
// Card only renders public directory fields (no email / id_document_url).
export type MechanicCardData = Omit<MechanicRow, "email" | "id_document_url"> & { trade?: string };


export function MechanicCard({ m }: { m: MechanicCardData }) {
  const initials = m.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const availDot =
    m.availability === "available" ? "bg-success" :
    m.availability === "busy" ? "bg-warning" : "bg-muted-foreground";

  return (
    <Link
      to="/mechanics/$id"
      params={{ id: m.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-subtle">
        {m.profile_picture_url ? (
          <img src={m.profile_picture_url} alt={m.full_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-hero text-3xl font-bold text-primary-foreground shadow-elegant">
              {initials || <Zap className="h-8 w-8" />}
            </div>
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-card backdrop-blur">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${availDot}`} />
          <span className="capitalize">{m.availability}</span>
        </div>
        {m.verified && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-elegant">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold">{m.full_name}</h3>
            <p className="truncate text-xs font-medium text-primary">{artisanTradeLabel(m.trade ?? "generator_mechanic", m.other_skill)}</p>
            {m.business_name && <p className="truncate text-xs text-muted-foreground">{m.business_name}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            {Number(m.rating_avg).toFixed(1)}
            <span className="text-muted-foreground">({m.rating_count})</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate">{m.city}, {m.state}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {m.services.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s}</Badge>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>{m.years_experience}+ yrs experience</span>
          <span className="font-medium text-primary">View profile →</span>
        </div>
      </div>
    </Link>
  );
}
