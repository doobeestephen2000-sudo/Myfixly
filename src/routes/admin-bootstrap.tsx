import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { bootstrapAdminAccess } from "@/components/lib/admin-bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin-bootstrap")({
  beforeLoad: async () => {
    const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
    if (!data.user) {
      throw new Error("You must be signed in to create an admin account.");
    }
  },
  component: AdminBootstrapPage,
});

function AdminBootstrapPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await bootstrapAdminAccess({ data: { email } });
      if (!result.success) {
        throw new Error("Admin bootstrap failed.");
      }

      toast.success("Admin access granted successfully.");
      navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create admin access.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-elegant">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Admin bootstrap</CardTitle>
          <CardDescription>Grant admin access to your own account for local setup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Your email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : "Create admin access"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="hover:underline">← Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
