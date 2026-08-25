import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["signin", "signup", "forgot", "reset"]).optional(),
    code: z.string().optional(),
    token_hash: z.string().optional(),
    type: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Myfixly" },
      { name: "description", content: "Sign in to Myfixly." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const { mode: initialMode, code, token_hash, type } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const completeRecoveryFlow = async () => {
      const recoveryType = type ?? "";
      const hasRecoveryTicket = Boolean(code || token_hash || recoveryType === "recovery");
      if (!hasRecoveryTicket) return;

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token_hash,
            type: "recovery",
          });
          if (error) throw error;
        }

        setMode("reset");
        toast.success("Recovery link verified. Set a new password below.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Recovery link could not be verified.");
        setMode("forgot");
      }
    };

    void completeRecoveryFlow();
  }, [code, token_hash, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created! Redirecting to complete your profile...");
        navigate({ to: "/register-mechanic" });
        return;
      }

      if (mode === "forgot") {
        const redirectUrl = `${window.location.origin}${import.meta.env.BASE_URL}auth?mode=reset`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });

        if (error) throw error;
        setResetSent(true);
        toast.success("Password reset email sent. Check your inbox.");
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated successfully.");
        navigate({ to: "/dashboard" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signup" ? "Join Myfixly" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Set a new password" : "Welcome back";

  const subtitle =
    mode === "signup"
      ? "Create your account to get started."
      : mode === "forgot"
        ? "Enter your email and we will send a recovery link."
        : mode === "reset"
          ? "Choose a new password for your account."
          : "Sign in to continue to your account.";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-elegant">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <Zap className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3 font-display text-2xl">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-9" placeholder="Your full name" />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-9" placeholder="you@example.com" />
              </div>
            </div>
            {(mode === "signin" || mode === "signup" || mode === "reset") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setMode("forgot")}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-9"
                    placeholder={mode === "reset" ? "Enter a new password" : "At least 6 characters"}
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full shadow-elegant" size="lg" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send recovery email"
                    : mode === "reset"
                      ? "Update password"
                      : "Sign in"}
            </Button>
          </form>
          {resetSent && mode === "forgot" && (
            <p className="mt-3 text-center text-sm text-emerald-600">Recovery email sent. You can close this tab and return when you receive it.</p>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : mode === "forgot" ? "Remember your password? " : mode === "reset" ? "Need to sign in instead? " : "Need an account? "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setResetSent(false);
                setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : mode === "reset" ? "signin" : "signup");
              }}
            >
              {mode === "signup" ? "Sign in" : mode === "forgot" ? "Back to sign in" : mode === "reset" ? "Sign in" : "Create account"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
