import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const bootstrapAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const signedInEmail = typeof context.claims?.email === "string" ? String(context.claims.email).trim().toLowerCase() : "";
    const providedEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : signedInEmail;
    const allowedEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length > 0 && !allowedEmails.includes(providedEmail)) {
      throw new Error("This email is not allowed to bootstrap admin access.");
    }

    if (!providedEmail) {
      throw new Error("No email was supplied for admin bootstrap.");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });

    if (error) {
      throw new Error(`Unable to create admin role: ${error.message}`);
    }

    return { success: true, email: providedEmail };
  });
