import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, ShieldCheck, CreditCard, Megaphone, Settings, Check, X, Ban, Zap, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { artisanTradeLabel, formatNaira } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Mechanic = Database["public"]["Tables"]["mechanics"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: userData.user };
  },
  component: Admin,
});

function Admin() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, revenue: 0 });
  const [fee, setFee] = useState<{ amount: number; currency: string }>({ amount: 5000, currency: "NGN" });
  const [publicKey, setPublicKey] = useState("");
  const [ann, setAnn] = useState({ title: "", message: "" });

  async function refresh() {
    const [mRes, pRes, sRes] = await Promise.all([
      supabase.rpc("get_admin_mechanics" as never),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("app_settings").select("key,value"),
    ]);
    setMechanics(mRes.data ?? []);
    setPayments(pRes.data ?? []);
    const feeRow = sRes.data?.find((r) => r.key === "registration_fee");
    const keyRow = sRes.data?.find((r) => r.key === "paystack_public_key");
    if (feeRow) setFee(feeRow.value as { amount: number; currency: string });
    if (keyRow) setPublicKey(typeof keyRow.value === "string" ? keyRow.value : "");

    const total = mRes.data?.length ?? 0;
    const verified = mRes.data?.filter((m) => m.verified).length ?? 0;
    const pending = mRes.data?.filter((m) => m.status === "pending").length ?? 0;
    const revenue = (pRes.data ?? []).filter((p) => p.status === "success").reduce((sum, p) => sum + Number(p.amount), 0);
    setStats({ total, verified, pending, revenue });
  }
  useEffect(() => { refresh(); }, []);

  async function setStatus(id: string, status: Mechanic["status"], extra: Partial<Mechanic> = {}) {
    const { error } = await supabase.rpc("admin_set_mechanic_status" as never, { _mechanic_id: id, _status: status } as never);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    refresh();
  }

  async function saveFee() {
    const { error } = await supabase.from("app_settings").update({ value: fee, updated_at: new Date().toISOString() }).eq("key", "registration_fee");
    if (error) return toast.error(error.message);
    toast.success("Fee updated");
  }

  async function savePaystackKey() {
    const { error } = await supabase.from("app_settings").update({ value: publicKey, updated_at: new Date().toISOString() }).eq("key", "paystack_public_key");
    if (error) return toast.error(error.message);
    toast.success("Paystack public key saved");
  }

  async function sendAnnouncement() {
    if (!ann.title || !ann.message) return toast.error("Fill title and message");
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({ title: ann.title, message: ann.message, created_by: user.user?.id });
    if (error) return toast.error(error.message);
    toast.success("Announcement sent");
    setAnn({ title: "", message: "" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-8 w-8 text-primary" /> Admin panel</h1>
          <p className="text-muted-foreground">Manage artisans, payments and settings.</p>
        </div>
        <Button asChild variant="outline"><Link to="/dashboard">← My dashboard</Link></Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users />} label="Total artisans" value={stats.total} />
        <Stat icon={<ShieldCheck />} label="Verified" value={stats.verified} />
        <Stat icon={<Zap />} label="Pending approval" value={stats.pending} />
        <Stat icon={<TrendingUp />} label="Revenue" value={formatNaira(stats.revenue)} />
      </div>

      <Tabs defaultValue="mechanics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="mechanics"><Users className="mr-1.5 h-4 w-4" />Artisans</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="mr-1.5 h-4 w-4" />Payments</TabsTrigger>
          <TabsTrigger value="announce"><Megaphone className="mr-1.5 h-4 w-4" />Announcements</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="mr-1.5 h-4 w-4" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="mechanics" className="mt-4 space-y-3">
          {mechanics.length === 0 ? <p className="text-muted-foreground">No artisans yet.</p> : mechanics.map((m) => (
            <Card key={m.id}>
              <CardContent className="grid grid-cols-[1fr_auto] gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.full_name}</p>
                    <Badge className={
                      m.status === "approved" ? "bg-success text-success-foreground" :
                      m.status === "pending" ? "bg-warning text-warning-foreground" :
                      "bg-destructive text-destructive-foreground"
                    }>{m.status}</Badge>
                    {m.verified && <Badge className="bg-primary"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>}
                    {m.paid && <Badge variant="secondary">Paid</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.city}, {m.state} · {m.email} · {m.phone}</p>
                  <p className="mt-1 text-sm font-medium text-primary">{artisanTradeLabel(m.trade, m.other_skill)}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus(m.id, "approved", { verified: true })}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
                  )}
                  {m.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "rejected")}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
                  )}
                  {m.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "suspended")}><Ban className="mr-1 h-3.5 w-3.5" />Suspend</Button>
                  )}
                  <Button size="sm" variant="ghost" asChild><Link to="/mechanics/$id" params={{ id: m.id }}>View</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-2">
          {payments.length === 0 ? <p className="text-muted-foreground">No payments yet.</p> : (
            <Card><CardContent className="p-0">
              <div className="divide-y">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{p.reference}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatNaira(Number(p.amount))}</p>
                      <Badge variant={p.status === "success" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="announce" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Send announcement</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
              <Textarea placeholder="Message" value={ann.message} onChange={(e) => setAnn({ ...ann, message: e.target.value })} rows={4} />
              <Button onClick={sendAnnouncement}><Megaphone className="mr-2 h-4 w-4" />Publish</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Registration fee</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={fee.amount} onChange={(e) => setFee({ ...fee, amount: parseInt(e.target.value || "0") })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={fee.currency} onChange={(e) => setFee({ ...fee, currency: e.target.value.toUpperCase() })} className="w-24" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Current: {formatNaira(fee.amount)}</p>
              <Button onClick={saveFee}>Save fee</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Paystack public key</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Public key (pk_live_... or pk_test_...)</Label>
              <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pk_test_xxxxxxxxxxxx" />
              <p className="text-xs text-muted-foreground">
                Also set <code className="rounded bg-muted px-1">PAYSTACK_SECRET_KEY</code> in project secrets for server-side verification.
              </p>
              <Button onClick={savePaystackKey}>Save key</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
