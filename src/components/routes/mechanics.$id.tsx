import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageCircle, Phone, MapPin, Star, ShieldCheck, Calendar, Zap, ArrowLeft, Heart, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { whatsappLink, telLink, googleMapsLink } from "@/lib/whatsapp";
import { tradeLabel } from "@/lib/constants";

import { MECHANIC_PUBLIC_COLUMNS } from "@/lib/constants";

const mechanicQuery = (id: string) => queryOptions({
  queryKey: ["mechanic", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("mechanics").select(MECHANIC_PUBLIC_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data || (data as { status: string }).status !== "approved") throw notFound();
    return data as unknown as import("@/components/mechanic-card").MechanicCardData;
  },
});

const galleryQuery = (id: string) => queryOptions({
  queryKey: ["mechanic-gallery", id],
  queryFn: async () => {
    const { data } = await supabase.from("mechanic_gallery").select("*").eq("mechanic_id", id).order("created_at");
    return data ?? [];
  },
});

const reviewsQuery = (id: string) => queryOptions({
  queryKey: ["mechanic-reviews", id],
  queryFn: async () => {
    const { data } = await supabase.from("reviews").select("*").eq("mechanic_id", id).order("created_at", { ascending: false });
    return data ?? [];
  },
});

export const Route = createFileRoute("/mechanics/$id")({
  loader: async ({ params, context }) => {
    await context.queryClient.ensureQueryData(mechanicQuery(params.id));
    void context.queryClient.prefetchQuery(galleryQuery(params.id));
    void context.queryClient.prefetchQuery(reviewsQuery(params.id));
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `Generator mechanic in Nigeria — Myfixly` },
      { name: "description", content: `View profile, ratings and contact this generator mechanic on WhatsApp.` },
      { property: "og:title", content: `Generator mechanic profile` },
      { property: "og:description", content: `Contact this verified generator mechanic directly.` },
    ],
  }),
  component: MechanicProfile,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">Mechanic not found</h1>
      <p className="mt-2 text-muted-foreground">This mechanic doesn't exist or isn't approved yet.</p>
      <Button asChild className="mt-4"><Link to="/mechanics">Browse all mechanics</Link></Button>
    </div>
  ),
});

function MechanicProfile() {
  const { id } = Route.useParams();
  const { data: m } = useSuspenseQuery(mechanicQuery(id));
  const { data: gallery = [] } = useQuery(galleryQuery(id));
  const { data: reviews = [] } = useQuery(reviewsQuery(id));
  const qc = useQueryClient();

  const [fav, setFav] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return JSON.parse(localStorage.getItem("gc:favorites") ?? "[]").includes(m.id); } catch { return false; }
  });

  function toggleFav() {
    if (typeof window === "undefined") return;
    try {
      const cur: string[] = JSON.parse(localStorage.getItem("gc:favorites") ?? "[]");
      const next = cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id];
      localStorage.setItem("gc:favorites", JSON.stringify(next));
      setFav(next.includes(m.id));
      toast.success(next.includes(m.id) ? "Saved to favorites" : "Removed from favorites");
    } catch { /* noop */ }
  }

  const availDot =
    m.availability === "available" ? "bg-success" :
    m.availability === "busy" ? "bg-warning" : "bg-muted-foreground";
  const initials = m.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/mechanics" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to mechanics
      </Link>

      {/* Hero card */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="relative h-40 bg-gradient-hero sm:h-52">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white 0%, transparent 40%)" }} />
        </div>
        <div className="relative -mt-16 grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-6 pb-6 sm:-mt-20 sm:gap-6 sm:px-8">
          <div className="shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-elegant">
            {m.profile_picture_url ? (
              <img src={m.profile_picture_url} alt={m.full_name} className="h-24 w-24 object-cover sm:h-32 sm:w-32" />
            ) : (
              <div className="grid h-24 w-24 place-items-center bg-gradient-hero text-3xl font-bold text-primary-foreground sm:h-32 sm:w-32">
                {initials || <Zap className="h-8 w-8" />}
              </div>
            )}
          </div>
          <div className="min-w-0 pt-16 sm:pt-20">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">{m.full_name}</h1>
              {m.verified && (
                <Badge className="gap-1 bg-primary"><ShieldCheck className="h-3.5 w-3.5" /> Verified</Badge>
              )}
            </div>
            <p className="text-sm font-medium text-primary">{tradeLabel((m as unknown as { trade?: string }).trade ?? "generator_mechanic")}</p>
            {m.business_name && <p className="text-muted-foreground">{m.business_name}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" /> <b>{Number(m.rating_avg).toFixed(1)}</b> <span className="text-muted-foreground">({m.rating_count} reviews)</span></span>
              <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {m.city}, {m.state}</span>
              <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-4 w-4" /> {m.years_experience}+ yrs</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${availDot}`} />
                <span className="capitalize">{m.availability}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-4 sm:p-6">
          <Button asChild size="lg" className="shadow-elegant">
            <a href={whatsappLink(m.whatsapp, `Hi ${m.full_name}, I found you on Myfixly. I need help with my generator.`)} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={telLink(m.phone)}><Phone className="mr-2 h-4 w-4" /> Call</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={googleMapsLink(m.latitude, m.longitude, `${m.address}, ${m.city}, ${m.state}`)} target="_blank" rel="noreferrer">
              <MapPin className="mr-2 h-4 w-4" /> View on Maps
            </a>
          </Button>
          <Button size="lg" variant={fav ? "default" : "outline"} onClick={toggleFav}>
            <Heart className={`mr-2 h-4 w-4 ${fav ? "fill-current" : ""}`} /> {fav ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {m.bio && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.bio}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Services & Brands</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services offered</p>
                <div className="flex flex-wrap gap-2">
                  {m.services.map((s) => <Badge key={s} className="capitalize">{s}</Badge>)}
                </div>
              </div>
              {m.brands.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brands / specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {m.brands.map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {gallery.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Work gallery</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((g) => (
                    <img key={g.id} src={g.image_url} alt={g.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <ReviewsSection mechanicId={m.id} reviews={reviews} onSubmitted={() => qc.invalidateQueries({ queryKey: ["mechanic-reviews", m.id] })} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Send an inquiry</CardTitle></CardHeader>
            <CardContent>
              <InquiryForm mechanicId={m.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Location</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{m.address}</p>
              <p className="text-muted-foreground">{m.city}, {m.state}</p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <a href={googleMapsLink(m.latitude, m.longitude, `${m.address}, ${m.city}, ${m.state}`)} target="_blank" rel="noreferrer">
                  <MapPin className="mr-2 h-4 w-4" /> Open in Google Maps
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InquiryForm({ mechanicId }: { mechanicId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return toast.error("Please fill your name and a message.");
    setLoading(true);
    const { error } = await supabase.from("inquiries").insert({
      mechanic_id: mechanicId, customer_name: name.trim(), customer_phone: phone.trim() || null, message: message.trim(),
    });
    setLoading(false);
    if (error) return toast.error("Could not send inquiry. Try again.");
    toast.success("Inquiry sent!");
    setName(""); setPhone(""); setMessage("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      <Textarea placeholder="Describe what you need help with" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} rows={4} required />
      <Button type="submit" disabled={loading} className="w-full"><Send className="mr-2 h-4 w-4" />{loading ? "Sending..." : "Send inquiry"}</Button>
    </form>
  );
}

function ReviewsSection({ mechanicId, reviews, onSubmitted }: { mechanicId: string; reviews: { id: string; customer_name: string; rating: number; comment: string | null; created_at: string }[]; onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter your name.");
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return toast.error("Please sign in to post a review.");
    }
    const { error } = await supabase.from("reviews").insert({
      mechanic_id: mechanicId, customer_id: uid, customer_name: name.trim(), rating, comment: comment.trim() || null,
    } as never);
    setLoading(false);
    if (error) return toast.error("Could not submit review.");
    toast.success("Thanks for your review!");
    setName(""); setComment(""); setRating(5); setOpen(false); onSubmitted();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reviews ({reviews.length})</CardTitle>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Write review"}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Share your experience" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} />
            <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Post review"}</Button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet — be the first!</p>
        ) : reviews.map((r) => (
          <div key={r.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.customer_name}</p>
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                ))}
              </div>
            </div>
            {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
