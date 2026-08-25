import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reference: z.string().min(3).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Ensure the payment record belongs to this user
    const [{ data: payment }, { data: feeSetting }] = await Promise.all([
      supabase.from("payments").select("*").eq("reference", data.reference).eq("user_id", userId).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "registration_fee").maybeSingle(),
    ]);

    if (!payment) throw new Error("Payment record not found.");
    const registrationFee = feeSetting?.value as { amount?: unknown; currency?: unknown } | null;
    const expectedAmount = Number(registrationFee?.amount);
    const expectedCurrency = typeof registrationFee?.currency === "string" ? registrationFee.currency.toUpperCase() : "";
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || !expectedCurrency) {
      throw new Error("The registration fee is not configured correctly.");
    }

    // The browser creates the reference for Paystack, but it is not trusted to
    // define the fee. The row must match the server-side registration setting.
    if (Number(payment.amount) !== expectedAmount || payment.currency.toUpperCase() !== expectedCurrency) {
      throw new Error("This payment does not match the configured registration fee.");
    }

    if (!secret) throw new Error("Payment verification is unavailable because Paystack is not configured.");
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = res.ok ? await res.json() as { status?: boolean; data?: { status?: string; amount?: number; currency?: string; reference?: string } } : null;
    const verified = body?.status === true
      && body.data?.status === "success"
      && body.data.reference === payment.reference
      && body.data.amount === Math.round(expectedAmount * 100)
      && body.data.currency?.toUpperCase() === expectedCurrency;

    if (!verified) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("reference", data.reference).eq("user_id", userId);
      return { success: false };
    }

    const { data: mechanic } = await supabaseAdmin.from("mechanics").select("id,id_document_url").eq("user_id", userId).maybeSingle();
    if (!mechanic?.id_document_url) {
      throw new Error("Complete your artisan profile, including government ID, before payment can be confirmed.");
    }

    await supabaseAdmin.from("payments").update({ status: "success", paid_at: new Date().toISOString() }).eq("reference", data.reference).eq("user_id", userId);
    await supabaseAdmin.from("mechanics").update({ paid: true }).eq("user_id", userId);
    return { success: true };
  });
