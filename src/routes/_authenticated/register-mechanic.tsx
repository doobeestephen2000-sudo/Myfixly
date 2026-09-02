import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NIGERIA_LGAS, NIGERIA_STATES, SERVICES, TRADES, formatNaira, isValidNigeriaLga } from "@/lib/constants";
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
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.user.id);
    if (!(roles ?? []).some((entry) => entry.role === "artisan" || entry.role === "mechanic")) {
      throw redirect({ to: "/dashboard" });
    }
    const { data: profile } = await supabase.from("profiles").select("full_name,email,phone").eq("id", user.user.id).maybeSingle();
    const { data: ownMechanics } = await supabase.rpc("get_my_mechanic" as never);
    const existing = (ownMechanics ?? [])[0] as typeof import("@/integrations/supabase/types").Database["public"]["Tables"]["mechanics"]["Row"] | undefined;
    if (existing?.paid && existing.status === "approved" && existing.verified) {
      throw redirect({ to: "/dashboard" });
    }
    return { existing, profile, user: user.user };
  },
  component: RegisterMechanic,
});

function RegisterMechanic() {
  const { existing, profile, user } = Route.useLoaderData();
  const [step, setStep] = useState<1 | 2 | 3>(existing ? (existing.paid ? 3 : 2) : 1);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [customSkillDialogOpen, setCustomSkillDialogOpen] = useState(false);
  const [customSkillError, setCustomSkillError] = useState("");

  const [f, setF] = useState({
    full_name: existing?.full_name ?? profile?.full_name ?? "",
    business_name: existing?.business_name ?? "",
    trade: ((existing as unknown as { trade?: string })?.trade) ?? "",
    other_skill: existing?.other_skill ?? "",
    phone: existing?.phone ?? profile?.phone ?? "",
    whatsapp: existing?.whatsapp ?? "",
    email: existing?.email ?? user.email ?? "",
    state: existing?.state ?? "",
    city: existing?.city ?? "",
    area: existing?.area ?? "",
    address: existing?.address ?? "",
    // Keep the field empty for a new application. The database default is only
    // used when an artisan deliberately leaves this optional field blank.
    years_experience: existing?.years_experience?.toString() ?? "",
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
  const allowedIdTypes = ["application/pdf", "image/jpeg", "image/png"];
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  function validateUpload(file: File | undefined, allowedTypes: string[], label: string) {
    if (!file) return false;

    const extension = file.name.split(".").pop()?.toLowerCase();
    const expectedExtension = file.type === "application/pdf"
      ? extension === "pdf"
      : file.type === "image/jpeg"
        ? extension === "jpg" || extension === "jpeg"
        : file.type === "image/png" && extension === "png";

    if (!allowedTypes.includes(file.type) || !expectedExtension) {
      toast.error(`${label} must be a ${allowedTypes.includes("application/pdf") ? "PDF, JPG/JPEG, or PNG" : "JPG/JPEG or PNG"} file.`);
      return false;
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${label} must be smaller than 5 MB.`);
      return false;
    }

    return true;
  }

  async function uploadFile(bucket: "mechanic-profiles" | "mechanic-ids", file: File): Promise<string | null> {
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error || !data?.path) {
      toast.error(`Unable to upload ${bucket === "mechanic-ids" ? "government ID" : "profile photo"}: ${error?.message ?? "storage did not return a file path"}`);
      return null;
    }
    if (bucket === "mechanic-ids") return data.path;

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(data.path);
    if (!publicUrl.publicUrl) {
      toast.error("Profile photo uploaded, but its display URL could not be created. Please try again.");
      return null;
    }
    return publicUrl.publicUrl;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!f.full_name || !f.phone || !f.state || !f.city || !f.address || !isValidNigeriaLga(f.state, f.city)) {
      return toast.error("Please fill required fields.");
    }
    if (!f.trade) return toast.error("Please select your trade.");
    if (f.trade === "other" && !f.other_skill.trim()) return toast.error("Please enter your skill or trade.");
    if (!f.id_document_url) {
      return toast.error("Government ID is required before you can submit your artisan registration.");
    }
    setSaving(true);
    const { years_experience, other_skill, ...profileFields } = f;
    const payload = {
      ...profileFields,
      other_skill: f.trade === "other" ? other_skill.trim() : null,
      user_id: user.id,
      ...(years_experience === "" ? {} : { years_experience: Number(years_experience) }),
    } as unknown as Record<string, unknown>;
    const { error } = existing
      ? await supabase.from("mechanics").update(payload as never).eq("user_id", user.id)
      : await supabase.from("mechanics").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved. Complete payment to activate your account.");
    setStep(2);
  }

  function handleTradeChange(trade: string) {
    setF((prev) => ({ ...prev, trade, other_skill: trade === "other" ? prev.other_skill : "" }));
    setCustomSkillError("");
    setCustomSkillDialogOpen(trade === "other");
  }

  function continueWithCustomSkill() {
    if (!f.other_skill.trim()) {
      setCustomSkillError("Please enter your skill or trade.");
      return;
    }
    setCustomSkillError("");
    setCustomSkillDialogOpen(false);
  }

  async function startPayment() {
    if (!settings) return toast.error("Fee not configured yet.");
    if (!publicKey) return toast.error("Payment isn't set up yet. Please contact admin.");
    if (!window.PaystackPop) return toast.error("Payment script not loaded â€” refresh the page.");
    setPaying(true);
    const reference = `MYFIXLY-${user.id.slice(0, 8)}-${Date.now()}`;
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
                <select value={f.trade} onChange={(e) => handleTradeChange(e.target.value || "")} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select Trade</option>
                  {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {f.trade === "other" && f.other_skill && <p className="mt-1 text-xs text-muted-foreground">Custom skill: <span className="font-medium text-foreground">{f.other_skill}</span></p>}
              </Field>
              <Field label="Full name *"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
              <Field label="Business name (optional)"><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} placeholder="Optional" /></Field>
              <Field label="Phone *"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></Field>
              <Field label="Additional contact (optional)"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
              <Field label="Email *" className="sm:col-span-2"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
              <Field label="Profile picture (optional)" className="sm:col-span-2">
                <div className="flex items-center gap-3">
                  {f.profile_picture_url && <img src={f.profile_picture_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                  <Input
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg,.png"
                    onClick={(e) => {
                      const input = e.currentTarget as HTMLInputElement;
                      input.value = "";
                    }}
                    onChange={async (e) => {
                      const input = e.target as HTMLInputElement;
                      const file = input.files?.[0];
                      if (!file) return;
                      if (!validateUpload(file, allowedProfileTypes, "Profile photo")) {
                        input.value = "";
                        return;
                      }

                      const url = await uploadFile("mechanic-profiles", file);
                      if (url) setF((prev) => ({ ...prev, profile_picture_url: url }));
                      input.value = "";
                    }}
                  />
                  {f.profile_picture_url && <Button type="button" variant="outline" size="sm" onClick={() => setF((prev) => ({ ...prev, profile_picture_url: "" }))}>Remove</Button>}
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Location</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="State *">
                <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, city: "" })} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select state</option>
                  {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="LGA">
                <select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} disabled={!f.state} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">{f.state ? "Select LGA" : "Select a state first"}</option>
                  {(NIGERIA_LGAS[f.state] ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                </select>
              </Field>
              <Field label="Area / Neighborhood"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
              <Field label="Full address *" className="sm:col-span-2"><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required rows={2} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Experience & services</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Years of experience"><Input type="number" min={0} max={70} step={1} value={f.years_experience} onChange={(e) => setF({ ...f, years_experience: e.target.value })} /></Field>
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
              <Field label="Government ID required (for verification) *">
                <Input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  onClick={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    input.value = "";
                  }}
                  onChange={async (e) => {
                    const input = e.target as HTMLInputElement;
                    const file = input.files?.[0];
                    if (!file) return;
                    if (!validateUpload(file, allowedIdTypes, "Government ID")) {
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
                {f.id_document_url && <p className="mt-1 text-xs text-success">Government ID uploaded âœ“</p>}
              </Field>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full shadow-elegant" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Save profile & continue to payment
          </Button>
        </form>
      )}

      <Dialog open={customSkillDialogOpen} onOpenChange={setCustomSkillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Type Your Skill</DialogTitle>
            <DialogDescription>Can&apos;t find your skill in the list? Enter the skill or trade you specialize in.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="other-skill">Your skill or trade *</Label>
            <Input id="other-skill" value={f.other_skill} onChange={(e) => { setF((prev) => ({ ...prev, other_skill: e.target.value })); setCustomSkillError(""); }} placeholder="Enter your skill or trade" autoFocus />
            {customSkillError && <p className="mt-2 text-sm text-destructive">{customSkillError}</p>}
          </div>
          <DialogFooter><Button type="button" onClick={continueWithCustomSkill}>Continue</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {step === 2 && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Registration fee</CardTitle>
            <CardDescription>Pay the one-time registration fee to submit your profile for review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground">
              <p className="text-sm opacity-90">Amount due</p>
              <p className="font-display text-4xl font-bold">{settings ? formatNaira(settings.amount) : "â€”"}</p>
              <p className="mt-1 text-xs opacity-80">One-time payment Â· Secure checkout via Paystack</p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">âœ… Get listed for thousands of customers</li>
              <li className="flex gap-2">âœ… Verified badge after admin review</li>
              <li className="flex gap-2">âœ… Direct service requests and calls after assignment</li>
              <li className="flex gap-2">âœ… Ratings, reviews & gallery</li>
            </ul>
            <Button size="lg" className="w-full shadow-elegant" onClick={startPayment} disabled={paying || !settings}>
              {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Pay {settings ? formatNaira(settings.amount) : ""} with Paystack
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>â† Edit profile</Button>
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
            <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
              Your application is pending approval. The artisan dashboard will become available after an administrator approves it.
            </p>
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
