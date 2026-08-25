import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Star, ShieldCheck, Calendar, Zap, ArrowLeft, Heart, Send, Paperclip, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      { name: "description", content: `View profile, ratings and request a verified Myfixly artisan.` },
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
        <div className="flex border-t border-border p-4 sm:p-6">
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
            <CardHeader><CardTitle>Services</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {m.services.map((s) => <Badge key={s} className="capitalize">{s}</Badge>)}
              </div>
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
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim() || !location) return toast.error("Please provide your name, request, and destination location.");
    setLoading(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (attachment) {
        if (attachment.size > 10 * 1024 * 1024) throw new Error("Attachments must be 10 MB or smaller.");
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Please sign in before attaching a file.");

        const safeName = attachment.name.replace(/[^\\w.-]/g, "_");
        attachmentPath = `${userData.user.id}/${mechanicId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("inquiry-attachments")
          .upload(attachmentPath, attachment, { contentType: attachment.type || undefined });
        if (uploadError) throw uploadError;
        attachmentName = attachment.name;
        attachmentType = attachment.type || "application/octet-stream";
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in before requesting an artisan.");
      const { data: mechanic, error: mechanicError } = await supabase.from("mechanics").select("trade,availability,status,verified").eq("id", mechanicId).maybeSingle();
      if (mechanicError) throw mechanicError;
      if (!mechanic || mechanic.status !== "approved" || !mechanic.verified || mechanic.availability !== "available") throw new Error("This artisan is not currently available. Please choose another artisan.");
      const { error } = await supabase.from("inquiries").insert({
        mechanic_id: mechanicId,
        customer_id: userData.user.id,
        customer_name: name.trim(),
        customer_phone: phone.trim() || null,
        message: message.trim(),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
        customer_latitude: location.latitude,
        customer_longitude: location.longitude,
        requested_trade: mechanic.trade,
      } as never);
      if (error) {
        if (attachmentPath) await supabase.storage.from("inquiry-attachments").remove([attachmentPath]);
        throw error;
      }

      toast.success("Request sent. Tracking will begin when the artisan accepts.");
      setName(""); setPhone(""); setMessage(""); setAttachment(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send inquiry. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        <Input aria-label="Phone number" placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      </div>
      <Textarea placeholder="Describe the job, issue, or parts you need help with" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} rows={4} required />
      <Button type="button" variant="outline" className="w-full" onClick={() => navigator.geolocation?.getCurrentPosition((p) => { setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }); toast.success("Destination location added."); }, () => toast.error("Location is required to track the artisan to you."), { enableHighAccuracy: true })}>
        <MapPin className="mr-2 h-4 w-4" />{location ? "Destination location added" : "Use my destination location"}
      </Button>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Paperclip className="h-4 w-4 shrink-0 text-primary" />{attachment ? <span className="truncate font-medium text-foreground">{attachment.name}</span> : "Attach a photo or document (optional)"}</span>
        <span className="shrink-0 text-xs font-medium text-primary">Browse</span>
        <Input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} disabled={loading} />
      </label>
      <p className="text-xs text-muted-foreground">Up to 10 MB. File attachments require a signed-in account to keep them private.</p>
      <Button type="submit" disabled={loading} className="w-full">{loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{loading ? "Sending request" : "Send request"}</Button>
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
