import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Edit, Image as ImageIcon, MessageSquare, Star, Trash2, Upload, Zap, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type Mechanic = Database["public"]["Tables"]["mechanics"]["Row"];
type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];
type Gallery = Database["public"]["Tables"]["mechanic_gallery"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const uid = userData.user.id;

    const { data: mech } = await supabase.from("mechanics").select("*").eq("user_id", uid).maybeSingle();
    return { user: userData.user, mechanic: mech };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, mechanic: initial } = Route.useLoaderData();
  const navigate = useNavigate();
  const [m, setM] = useState<Mechanic | null>(initial);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gallery, setGallery] = useState<Gallery[]>([]);

  useEffect(() => {
    if (!m) return;
    supabase.from("inquiries").select("*").eq("mechanic_id", m.id).order("created_at", { ascending: false }).then(({ data }) => setInquiries(data ?? []));
    supabase.from("reviews").select("*").eq("mechanic_id", m.id).order("created_at", { ascending: false }).then(({ data }) => setReviews(data ?? []));
    supabase.from("mechanic_gallery").select("*").eq("mechanic_id", m.id).order("created_at").then(({ data }) => setGallery(data ?? []));
  }, [m]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  async function updateAvailability(v: Mechanic["availability"]) {
    if (!m) return;
    const { error } = await supabase.from("mechanics").update({ availability: v }).eq("id", m.id);
    if (error) return toast.error(error.message);
    setM({ ...m, availability: v });
    toast.success("Availability updated");
  }

  if (!m) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
          <Zap className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">Welcome!</h1>
        <p className="mt-2 text-muted-foreground">You haven't created a mechanic profile yet. Get listed and start receiving customers.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild size="lg" className="shadow-elegant"><Link to="/register-mechanic">Create profile</Link></Button>
          <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </div>
    );
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
        <div>
          <h1 className="font-display text-3xl font-bold">My dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {m.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </div>

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
          {inquiries.length === 0 ? <Empty text="No inquiries yet." /> : inquiries.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{i.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                {i.customer_phone && <p className="text-sm text-muted-foreground">{i.customer_phone}</p>}
                <p className="mt-2 text-sm">{i.message}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          {reviews.length === 0 ? <Empty text="No reviews yet." /> : reviews.map((r) => (
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
