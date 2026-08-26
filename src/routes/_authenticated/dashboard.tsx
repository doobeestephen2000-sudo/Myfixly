import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit, Image as ImageIcon, MessageSquare, Star, Trash2, Upload, Zap, Clock, CheckCircle2, ArrowRight, Paperclip, ExternalLink, LoaderCircle, Wrench, PlugZap, Hammer, Snowflake, Flame, Paintbrush, Grid3X3, BrickWall, Sparkles, House, Satellite, Refrigerator, ShieldCheck, MapPin, MessagesSquare, CircleCheckBig } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";
import { TRADES } from "@/lib/constants";
import { ArtisanTripControls } from "@/components/trip-controls";
import { profileAvatar } from "@/lib/avatar";

type Mechanic = Database["public"]["Tables"]["mechanics"]["Row"];
type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];
type Gallery = Database["public"]["Tables"]["mechanic_gallery"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const uid = userData.user.id;
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("full_name,avatar_url,gender").eq("id", uid).maybeSingle(),
    ]);
    const { data: ownMechanics } = await supabase.rpc("get_my_mechanic" as never);
    const mech = (ownMechanics ?? [])[0] as Mechanic | undefined;
    const isArtisan = (roles ?? []).some((entry) => entry.role === "artisan" || entry.role === "mechanic");
    return { user: userData.user, mechanic: mech, profile, isArtisan };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, mechanic: initial, profile, isArtisan } = Route.useLoaderData();
  const [m, setM] = useState<Mechanic | null>(initial);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gallery, setGallery] = useState<Gallery[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(Boolean(initial));

  useEffect(() => {
    if (!m) return;
    let active = true;
    setDashboardLoading(true);
    void Promise.all([
      supabase.from("inquiries").select("*").eq("mechanic_id", m.id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").eq("mechanic_id", m.id).order("created_at", { ascending: false }),
      supabase.from("mechanic_gallery").select("*").eq("mechanic_id", m.id).order("created_at"),
    ]).then(([inquiryResult, reviewResult, galleryResult]) => {
      if (!active) return;
      if (inquiryResult.error || reviewResult.error || galleryResult.error) {
        toast.error("Some dashboard details could not be loaded. Please refresh.");
      }
      setInquiries(inquiryResult.data ?? []);
      setReviews(reviewResult.data ?? []);
      setGallery(galleryResult.data ?? []);
    }).finally(() => {
      if (active) setDashboardLoading(false);
    });
    return () => { active = false; };
  }, [m]);

  useEffect(() => {
    if (!m) return;
    const channel = supabase.channel(`artisan-requests:${m.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries", filter: `mechanic_id=eq.${m.id}` }, (payload) => {
        if (payload.eventType === "INSERT") toast.info("New service request received");
        void supabase.from("inquiries").select("*").eq("mechanic_id", m.id).order("created_at", { ascending: false }).then(({ data }) => setInquiries(data ?? []));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [m]);

  async function updateAvailability(v: Mechanic["availability"]) {
    if (!m) return;
    const { error } = await supabase.from("mechanics").update({ availability: v }).eq("id", m.id);
    if (error) return toast.error(error.message);
    setM({ ...m, availability: v });
    toast.success("Availability updated");
  }

  if (!m && !isArtisan) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Welcome profile={profile} fallbackName={user.user_metadata?.full_name ?? user.email ?? "there"} />
        <CustomerRequests userId={user.id} />
        <MarketplaceDiscovery />
      </div>
    );
  }

  if (!m) return <div className="mx-auto max-w-3xl px-4 py-10"><Welcome profile={profile} fallbackName={user.user_metadata?.full_name ?? "there"} /><Card><CardContent className="p-6"><p className="font-semibold">Complete your artisan profile</p><p className="mt-1 text-sm text-muted-foreground">Add your professional details to begin receiving service requests.</p><Button asChild className="mt-4"><Link to="/register-mechanic">Complete profile</Link></Button></CardContent></Card></div>;

  if (isArtisan && (m.status !== "approved" || !m.paid || !m.verified)) {
    return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8"><Welcome profile={profile} fallbackName={m.full_name} /><Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Registration Status: <span className="font-semibold text-foreground">Pending Approval</span></p><p className="mt-3 text-sm leading-6 text-muted-foreground">Your registration and payment have been received. Your account is currently being reviewed by MyFixly. You will be notified when your registration is approved.</p></CardContent></Card></div>;
  }

  if (isArtisan) {
    return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8"><Welcome profile={profile} fallbackName={m.full_name} /><Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Account Status: <span className="font-semibold text-foreground">Approved</span></p></CardContent></Card><section className="mt-6"><h2 className="font-display text-xl font-bold">Job Requests</h2><div className="mt-3 space-y-3">{dashboardLoading ? <LoadingPanel label="Loading job requests" /> : inquiries.length === 0 ? <Empty text="No job requests yet." /> : inquiries.map((i) => <Card key={i.id}><CardContent className="p-4"><p className="font-semibold">{i.customer_name}</p>{i.status === "accepted" && i.customer_phone && <p className="mt-1 text-sm text-muted-foreground">{i.customer_phone}</p>}<p className="mt-2 text-sm">{i.message}</p><ArtisanTripControls inquiry={i as unknown as { id: string; customer_id: string | null; status: "pending" | "accepted" | "declined" | "cancelled" | "completed" }} artisanId={user.id} /></CardContent></Card>)}</div></section></div>;
  }

  const statusMap = {
    pending: { label: "Under review", color: "bg-warning text-warning-foreground" },
    approved: { label: "Approved & live", color: "bg-success text-success-foreground" },
    rejected: { label: "Rejected", color: "bg-destructive text-destructive-foreground" },
    suspended: { label: "Suspended", color: "bg-destructive text-destructive-foreground" },
  } as const;
  const s = statusMap[m.status];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Welcome profile={profile} fallbackName={m.full_name} />
      </div>

      <MarketplaceDiscovery compact />

      {inquiries.filter((inquiry) => inquiry.status === "pending").length > 0 && (
        <Card className="mb-6 border-primary/35 bg-primary/5 shadow-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-semibold">New service request{inquiries.filter((inquiry) => inquiry.status === "pending").length > 1 ? "s" : ""} waiting</p><p className="text-sm text-muted-foreground">Open Inquiries to accept or decline the customer request.</p></div>
            <Badge>{inquiries.filter((inquiry) => inquiry.status === "pending").length}</Badge>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Status" value={<Badge className={s.color}>{s.label}</Badge>} />
        <StatCard icon={<Star className="h-5 w-5" />} label="Rating" value={<span className="font-display text-2xl font-bold">{Number(m.rating_avg).toFixed(1)}<span className="ml-1 text-sm text-muted-foreground">/ 5</span></span>} />
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Inquiries" value={<span className="font-display text-2xl font-bold">{inquiries.length}</span>} />
        <StatCard icon={<Star className="h-5 w-5" />} label="Reviews" value={<span className="font-display text-2xl font-bold">{reviews.length}</span>} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(["available", "busy", "offline"] as const).map((v) => (
              <Button key={v} variant={m.availability === v ? "default" : "outline"} onClick={() => updateAvailability(v)} className="capitalize">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${v === "available" ? "bg-success" : v === "busy" ? "bg-warning" : "bg-muted-foreground"}`} />
                {v}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inquiries">
        <TabsList>
          <TabsTrigger value="inquiries"><MessageSquare className="mr-1.5 h-4 w-4" />Inquiries</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="mr-1.5 h-4 w-4" />Reviews</TabsTrigger>
          <TabsTrigger value="gallery"><ImageIcon className="mr-1.5 h-4 w-4" />Gallery</TabsTrigger>
          <TabsTrigger value="profile"><Edit className="mr-1.5 h-4 w-4" />Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="inquiries" className="mt-4 space-y-3">
          {dashboardLoading ? <LoadingPanel label="Loading customer requests" /> : inquiries.length === 0 ? <Empty text="No inquiries yet." /> : inquiries.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{i.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                {i.customer_phone && <p className="text-sm text-muted-foreground">{i.customer_phone}</p>}
                <p className="mt-2 text-sm">{i.message}</p>
                <ArtisanTripControls inquiry={i as unknown as { id: string; customer_id: string | null; status: "pending" | "accepted" | "declined" | "cancelled" | "completed" }} artisanId={user.id} />
                {i.attachment_path && i.attachment_name && <InquiryAttachment path={i.attachment_path} name={i.attachment_name} />}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          {dashboardLoading ? <LoadingPanel label="Loading reviews" /> : reviews.length === 0 ? <Empty text="No reviews yet." /> : reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{r.customer_name}</p>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <GalleryPanel mechanicId={m.id} userId={user.id} gallery={gallery} onChange={setGallery} />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="mb-3 text-sm text-muted-foreground">Edit your profile info, brands, and services.</p>
              <Button asChild><Link to="/register-mechanic"><Edit className="mr-2 h-4 w-4" />Edit profile</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Welcome({ profile, fallbackName }: { profile: { full_name?: string | null; avatar_url?: string | null; gender?: string | null } | null; fallbackName: string }) {
  const name = profile?.full_name || fallbackName;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const path = profile?.avatar_url ?? null;
    if (!path) { setAvatarUrl(null); return; }
    // Legacy values may already be public URLs. Newly uploaded avatars are
    // private object paths and must be resolved exactly as they are in Settings.
    if (/^https?:\/\//i.test(path)) { setAvatarUrl(path); return; }
    let active = true;
    void supabase.storage.from("profile-avatars").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (active) setAvatarUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [profile?.avatar_url]);

  return <div className="mb-6 flex items-center gap-3"><img src={profileAvatar({ ...profile, avatar_url: avatarUrl })} alt="" className="h-12 w-12 rounded-full object-cover" /><div><h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome, {firstName} 👋</h1><p className="text-sm text-muted-foreground">Your Myfixly dashboard</p></div></div>;
}

function CustomerRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<Array<{ id: string; status: string; created_at: string; mechanic_id: string; customer_latitude: number | null; customer_longitude: number | null }>>([]);
  const [trips, setTrips] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("inquiries").select("id,status,created_at,mechanic_id,customer_latitude,customer_longitude").eq("customer_id", userId).order("created_at", { ascending: false });
      if (!active) return;
      setRequests((data ?? []) as typeof requests);
      const ids = (data ?? []).map((r) => r.id);
      if (ids.length) { const { data: activeTrips } = await supabase.from("active_trips" as never).select("id,request_id").in("request_id", ids); if (active) setTrips(Object.fromEntries((activeTrips ?? []).map((t: any) => [t.request_id, t.id]))); }
    };
    void load();
    const channel = supabase.channel(`customer-requests:${userId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "inquiries", filter: `customer_id=eq.${userId}` }, () => { toast.info("Your service request was updated"); void load(); }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);
  if (!requests.length) return null;
  return <Card className="mb-6"><CardHeader><CardTitle>Your service requests</CardTitle></CardHeader><CardContent className="space-y-3">{requests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 text-sm"><span><b className="capitalize">{request.status === "pending" ? "Waiting for artisan response" : request.status === "unavailable" ? "No available artisans found" : request.status.replaceAll("_", " ")}</b><span className="ml-2 text-muted-foreground">{new Date(request.created_at).toLocaleString()}</span>{request.status === "pending" && <span className="ml-2 text-muted-foreground">Finding an available artisan…</span>}</span>{request.status === "accepted" && trips[request.id] && <Button size="sm" asChild><Link to="/trips/$tripId" params={{ tripId: trips[request.id] }}>Track artisan</Link></Button>}</div>)}</CardContent></Card>;
}

const tradeIcons = {
  generator_mechanic: Zap,
  plumber: Wrench,
  electrician: PlugZap,
  carpenter: Hammer,
  ac_technician: Snowflake,
  welder: Flame,
  painter: Paintbrush,
  tiler: Grid3X3,
  bricklayer: BrickWall,
  cleaner: Sparkles,
  roofer: House,
  satellite_installer: Satellite,
  fridge_repair: Refrigerator,
  other: Wrench,
} as const;

const tradeDescriptions: Record<string, string> = {
  generator_mechanic: "Generator repairs and servicing",
  plumber: "Plumbing and water services",
  electrician: "Electrical installation and repairs",
  carpenter: "Furniture, fittings and woodwork",
  ac_technician: "Cooling and refrigeration support",
  welder: "Metal fabrication and repairs",
  painter: "Interior and exterior finishing",
  tiler: "Floor and wall tile installation",
  bricklayer: "Building and masonry work",
  cleaner: "Home and office cleaning",
  roofer: "Roof installation and repairs",
  satellite_installer: "CCTV and satellite installations",
  fridge_repair: "Fridge and freezer repairs",
  other: "Find skilled local professionals",
};

function MarketplaceDiscovery({ showProfileCta = false, compact = false }: { showProfileCta?: boolean; compact?: boolean }) {
  const categories = compact ? TRADES.slice(0, 4) : TRADES;

  return (
    <div className={compact ? "mb-8" : "space-y-8"}>
      {!compact && (
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-subtle p-5 shadow-card sm:p-7">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant"><Zap className="h-6 w-6" /></div>
          <h1 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Join the <span className="text-primary">Myfixly</span> marketplace.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Create your professional profile to start reaching customers looking for trusted artisans near them.</p>
          {showProfileCta && <Button asChild size="lg" className="mt-5 w-full shadow-elegant sm:w-auto"><Link to="/register-mechanic">Create your profile <ArrowRight className="h-4 w-4" /></Link></Button>}
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="font-display text-2xl font-bold">{compact ? "Explore artisan services" : "What service do you need?"}</h2><p className="mt-1 text-sm text-muted-foreground">Choose a service to see available professionals.</p></div>
          {!compact && <Link to="/mechanics" className="shrink-0 text-sm font-semibold text-primary hover:underline">See all</Link>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((trade) => {
            const Icon = tradeIcons[trade.key];
            return <Link key={trade.key} to="/mechanics" search={{ trade: trade.key }} className="group min-h-36 rounded-2xl border border-primary/15 bg-card p-4 shadow-soft transition duration-200 active:scale-[0.97] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-card">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" /></span>
              <p className="mt-3 font-semibold leading-5">{trade.label}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{tradeDescriptions[trade.key]}</p>
            </Link>;
          })}
        </div>
      </section>

      {!compact && <>
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-subtle p-5 shadow-card sm:p-7">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant"><Zap className="h-6 w-6" /></div>
          <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything you need, <span className="text-primary">fixed by a pro.</span></h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Find trusted artisans around you for repairs, maintenance, installations and everyday services.</p>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">POPULAR SERVICES</p><h2 className="mt-1 font-display text-2xl font-bold">Popular services</h2><p className="mt-1 text-sm text-muted-foreground">Explore useful services from Myfixly’s existing artisan categories.</p></div><Wrench className="h-8 w-8 shrink-0 text-primary" /></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {TRADES.slice(0, 4).map((trade) => <Link key={trade.key} to="/mechanics" search={{ trade: trade.key }} className="flex items-center justify-between rounded-xl bg-muted/65 px-4 py-3 text-sm font-semibold transition-colors hover:bg-primary/10 hover:text-primary"><span>{trade.label}</span><span className="inline-flex items-center gap-1 text-xs text-primary">Find an artisan <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}
          </div>
        </section>

        <section className="rounded-3xl border border-primary/25 bg-card p-5 text-card-foreground shadow-card sm:flex sm:items-center sm:justify-between sm:p-6">
          <div><div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><MapPin className="h-5 w-5" /></div><h2 className="font-display text-2xl font-bold">Find artisans near you</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Browse skilled professionals available in your area.</p></div>
          <Button asChild size="lg" className="mt-5 w-full sm:mt-0 sm:w-auto"><Link to="/mechanics">Find artisans <ArrowRight className="h-4 w-4" /></Link></Button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ icon: ShieldCheck, label: "Verified artisans" }, { icon: MapPin, label: "Local professionals" }, { icon: MessagesSquare, label: "Easy communication" }, { icon: CircleCheckBig, label: "The right pro for the job" }].map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><Icon className="h-5 w-5 shrink-0 text-primary" /><span className="text-sm font-semibold">{label}</span></div>)}
        </section>
      </>}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="mt-0.5">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-10 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-primary" />{label}</div>;
}

function InquiryAttachment({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.storage.from("inquiry-attachments").createSignedUrl(path, 60 * 60).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) setFailed(true);
      else setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);

  if (failed) return <p className="mt-3 text-xs text-muted-foreground">A file was attached but is no longer available.</p>;

  return (
    <div className="mt-3">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15">
          <Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{name}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading attachment</span>}
    </div>
  );
}

function GalleryPanel({ mechanicId, userId, gallery, onChange }: { mechanicId: string; userId: string; gallery: Gallery[]; onChange: (g: Gallery[]) => void }) {
  const [uploading, setUploading] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("mechanic-gallery").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("mechanic-gallery").getPublicUrl(path);
    const { data: inserted, error: insErr } = await supabase.from("mechanic_gallery").insert({ mechanic_id: mechanicId, image_url: data.publicUrl }).select().single();
    setUploading(false);
    if (insErr || !inserted) return toast.error(insErr?.message ?? "Upload failed");
    onChange([...gallery, inserted]);
    toast.success("Uploaded");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("mechanic_gallery").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange(gallery.filter((g) => g.id !== id));
  }

  return (
    <Card>
      <CardContent className="p-6">
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border p-4 hover:bg-accent">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{uploading ? "Uploading..." : "Click to upload a photo"}</span>
          <Input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
        </label>
        {gallery.length === 0 ? <Empty text="No photos yet." /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((g) => (
              <div key={g.id} className="group relative overflow-hidden rounded-xl">
                <img src={g.image_url} alt="" className="aspect-square w-full object-cover" />
                <button onClick={() => remove(g.id)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-elegant transition-opacity group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
