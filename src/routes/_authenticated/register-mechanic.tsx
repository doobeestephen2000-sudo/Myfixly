import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NIGERIA_STATES, SERVICES, TRADES, formatNaira } from "@/lib/constants";
import { verifyPayment } from "@/lib/payments.functions";

declare global {
  interface Window {
    PaystackPop?: {
      setup(opts: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (r: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe(): void };
    };
  }
}

export const Route = createFileRoute("/_authenticated/register-mechanic")({
  loader: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: existing } = await supabase.from("mechanics").select("*").eq("user_id", user.user.id).maybeSingle();
    return { existing, user: user.user };
  },
  component: RegisterMechanic,
});

function RegisterMechanic() {
  const { existing, user } = Route.useLoaderData();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(existing ? (existing.paid ? 3 : 2) : 1);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);

  const [f, setF] = useState({
    full_name: existing?.full_name ?? "",
    business_name: existing?.business_name ?? "",
    trade: ((existing as unknown as { trade?: string })?.trade) ?? "generator_mechanic",
    phone: existing?.phone ?? "",
    whatsapp: existing?.whatsapp ?? "",
    email: existing?.email ?? user.email ?? "",
    state: existing?.state ?? "",
    city: existing?.city ?? "",
    area: existing?.area ?? "",
    address: existing?.address ?? "",
    latitude: existing?.latitude ?? null as number | null,
    longitude: existing?.longitude ?? null as number | null,
    years_experience: existing?.years_experience ?? 0,
    services: (existing?.services ?? []) as string[],
    bio: existing?.bio ?? "",
    profile_picture_url: existing?.profile_picture_url ?? "",
    id_document_url: existing?.id_document_url ?? "",
  });

  const [settings, setSettings] = useState<{ amount: number; currency: string } | null>(null);
  const [publicKey, setPublicKey] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("key,value").in("key", ["registration_fee", "paystack_public_key"]);
      const feeRow = data?.find((r) => r.key === "registration_fee");
      const keyRow = data?.find((r) => r.key === "paystack_public_key");
      if (feeRow) setSettings(feeRow.value as { amount: number; currency: string });
      if (keyRow) setPublicKey(typeof keyRow.value === "string" ? keyRow.value : (keyRow.value as { key?: string })?.key ?? "");
    })();
  }, []);

  const allowedProfileTypes = ["image/jpeg", "image/png"];
  const allowedIdTypes = ["application/pdf"];

  function validateUpload(file: File | undefined, allowedTypes: string[]) {
    if (!file) return false;

    const isAllowedMimeType = allowedTypes.includes(file.type);
    const isAllowedExtension = /\.(jpe?g|png|pdf)$/i.test(file.name);

    if (!isAllowedMimeType && !isAllowedExtension) {
      toast.error("Only JPEG, PNG, and PDF files are allowed.");
      return false;
    }

    return true;
  }

  const STORAGE_BUCKET_ALIASES = {
    profile: ["artisan-profiles", "mechanic-profiles"],
    id: ["artisan-ids", "mechanic-ids"],
  } as const;

  async function resolveBucket(type: keyof typeof STORAGE_BUCKET_ALIASES): Promise<string> {
    const candidates = STORAGE_BUCKET_ALIASES[type];

    for (const candidate of candidates) {
      const { data, error } = await supabase.storage.getBucket(candidate);
      if (!error && data) return candidate;
    }

    return candidates[0];
  }

  async function uploadFile(bucket: string, file: File): Promise<string | null> {
    const bucketType = bucket === "mechanic-profiles" || bucket === "artisan-profiles" ? "profile" : "id";
    const activeBucket = await resolveBucket(bucketType);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(activeBucket).upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return null; }
    if (bucketType === "profile") {
      const { data } = supabase.storage.from(activeBucket).getPublicUrl(path);
      return data.publicUrl;
    }
    const { data: signed } = await supabase.storage.from(activeBucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? path;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!f.full_name || !f.phone || !f.whatsapp || !f.state || !f.city || !f.address) {
      return toast.error("Please fill required fields.");
    }
    if (!f.profile_picture_url) {
      return toast.error("A profile picture is required before you can submit your artisan registration.");
    }
    if (!f.id_document_url) {
      return toast.error("Government ID is required before you can submit your artisan registration.");
    }
    setSaving(true);
    const payload = { ...f, user_id: user.id } as unknown as Record<string, unknown>;
    const { error } = existing
      ? await supabase.from("mechanics").update(payload as never).eq("user_id", user.id)
      : await supabase.from("mechanics").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved. Complete payment to activate your account.");
    setStep(2);
  }

  async function startPayment() {
    if (!settings) return toast.error("Fee not configured yet.");
    if (!publicKey) return toast.error("Payment isn't set up yet. Please contact admin.");
    if (!window.PaystackPop) return toast.error("Payment script not loaded — refresh the page.");
    setPaying(true);
    const reference = `GC-${user.id.slice(0, 8)}-${Date.now()}`;
    // record pending payment
    await supabase.from("payments").insert({
      user_id: user.id, reference, amount: settings.amount, currency: settings.currency, provider: "paystack", status: "pending",
    });

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: f.email || user.email!,
      amount: settings.amount * 100,
      currency: settings.currency,
      ref: reference,
      metadata: { user_id: user.id },
      callback: async (r) => {
        try {
          const result = await verifyPayment({ data: { reference: r.reference } });
          if (result.success) {
            toast.success("Payment successful! Your account is under review.");
            setStep(3);
          } else {
            toast.error("Payment verification failed.");
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Verification failed");
        } finally {
          setPaying(false);
        }
      },
      onClose: () => { setPaying(false); toast.info("Payment cancelled."); },
    });
    handler.openIframe();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Complete your registration</h1>
        <p className="mt-1 text-muted-foreground">Fill in your details, then complete the one-time registration fee.</p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {n === 1 ? "Your profile" : n === 2 ? "Payment" : "Under review"}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={saveProfile} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Your trade *" className="sm:col-span-2">
                <select value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Full name *"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
              <Field label="Business name (optional)"><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} placeholder="Optional" /></Field>
              <Field label="Phone *"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></Field>
              <Field label="WhatsApp number *"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} required /></Field>
              <Field label="Email *" className="sm:col-span-2"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
              <Field label="Profile picture *" className="sm:col-span-2">
                <div className="flex items-center gap-3">
                  {f.profile_picture_url && <img src={f.profile_picture_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png"
                    onClick={(e) => {
                      const input = e.currentTarget as HTMLInputElement;
                      input.value = "";
                    }}
                    onChange={async (e) => {
                      const input = e.target as HTMLInputElement;
                      const file = input.files?.[0];
                      if (!file) return;
                      if (!validateUpload(file, allowedProfileTypes)) {
                        input.value = "";
                        return;
                      }

                      const url = await uploadFile("mechanic-profiles", file);
                      if (url) setF((prev) => ({ ...prev, profile_picture_url: url }));
                      input.value = "";
                    }}
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Location</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="State *">
                <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select state</option>
                  {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="City *"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></Field>
              <Field label="Area / Neighborhood"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
              <Field label="Full address *" className="sm:col-span-2"><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required rows={2} /></Field>
              <Field label="GPS Location" className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => {
                  if (!navigator.geolocation) return toast.error("Geolocation not supported.");
                  navigator.geolocation.getCurrentPosition(
                    (pos) => { setF({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }); toast.success("Location captured"); },
                    () => toast.error("Could not get location.")
                  );
                }}>{f.latitude ? `📍 ${f.latitude.toFixed(4)}, ${f.longitude?.toFixed(4)}` : "Use my current location"}</Button>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Experience & services</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Years of experience"><Input type="number" min={0} max={70} value={f.years_experience} onChange={(e) => setF({ ...f, years_experience: parseInt(e.target.value || "0") })} /></Field>
              <div>
                <Label>Services offered</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SERVICES.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <Checkbox checked={f.services.includes(s.key)} onCheckedChange={(v) => setF((prev) => ({ ...prev, services: v ? [...prev.services, s.key] : prev.services.filter((x) => x !== s.key) }))} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Short bio"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={4} maxLength={600} placeholder="Tell customers about your work, specialties, and what makes you great." /></Field>
              <Field label="Government ID required (for verification) * PDF only">
                <Input
                  type="file"
                  accept="application/pdf"
                  onClick={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    input.value = "";
                  }}
                  onChange={async (e) => {
                    const input = e.target as HTMLInputElement;
                    const file = input.files?.[0];
                    if (!file) return;
                    if (!validateUpload(file, allowedIdTypes)) {
                      input.value = "";
                      return;
                    }

                    const url = await uploadFile("mechanic-ids", file);
                    if (url) {
                      setF((prev) => ({ ...prev, id_document_url: url }));
                      toast.success("Government ID uploaded");
                    }
                    input.value = "";
                  }}
                />
                {f.id_document_url && <p className="mt-1 text-xs text-success">Government ID uploaded ✓</p>}
              </Field>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full shadow-elegant" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Save profile & continue to payment
          </Button>
        </form>
      )}

      {step === 2 && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Registration fee</CardTitle>
            <CardDescription>Pay the one-time registration fee to submit your profile for review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground">
              <p className="text-sm opacity-90">Amount due</p>
              <p className="font-display text-4xl font-bold">{settings ? formatNaira(settings.amount) : "—"}</p>
              <p className="mt-1 text-xs opacity-80">One-time payment · Secure checkout via Paystack</p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">✅ Get listed for thousands of customers</li>
              <li className="flex gap-2">✅ Verified badge after admin review</li>
              <li className="flex gap-2">✅ Direct WhatsApp & call inquiries</li>
              <li className="flex gap-2">✅ Ratings, reviews & gallery</li>
            </ul>
            <Button size="lg" className="w-full shadow-elegant" onClick={startPayment} disabled={paying || !settings}>
              {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Pay {settings ? formatNaira(settings.amount) : ""} with Paystack
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>← Edit profile</Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
              <Zap className="h-8 w-8" />
            </div>
            <CardTitle className="mt-4 font-display text-2xl">You're all set!</CardTitle>
            <CardDescription>Your profile has been submitted for admin review. You'll be notified once approved.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard →</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
