import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reference: z.string().min(3).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Ensure the payment record belongs to this user
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("reference", data.reference)
      .eq("user_id", userId)
      .maybeSingle();

    if (!payment) throw new Error("Payment record not found.");

    let verified = false;
    if (secret) {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        const body = await res.json() as { status?: boolean; data?: { status?: string } };
        verified = body.status === true && body.data?.status === "success";
      }
    } else {
      // Dev fallback: mark success if secret not configured yet (so the flow can be tested).
      verified = true;
    }

    if (!verified) {
      await supabase.from("payments").update({ status: "failed" }).eq("reference", data.reference);
      return { success: false };
    }

    await supabase.from("payments").update({ status: "success", paid_at: new Date().toISOString() }).eq("reference", data.reference);
    await supabase.from("mechanics").update({ paid: true }).eq("user_id", userId);
    return { success: true };
  });
