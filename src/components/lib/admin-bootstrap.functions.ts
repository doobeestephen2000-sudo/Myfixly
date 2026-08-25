import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const bootstrapAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => z.object({}).parse({}))
  .handler(async ({ context }) => {
    const signedInEmail = typeof context.claims?.email === "string" ? String(context.claims.email).trim().toLowerCase() : "";
    const allowedEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedEmails.length) {
      throw new Error("Admin bootstrap is not configured.");
    }
    if (!signedInEmail || !allowedEmails.includes(signedInEmail)) {
      throw new Error("This email is not allowed to bootstrap admin access.");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });

    if (error) {
      throw new Error(`Unable to create admin role: ${error.message}`);
    }

    return { success: true, email: signedInEmail };
  });
