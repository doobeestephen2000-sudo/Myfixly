import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, Fingerprint, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { biometricAuth, enableBiometricLogin, getRememberedBiometricLogin, isBiometricCredentialInvalidated } from "@/lib/biometric-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

const ACKNOWLEDGEMENT_VERSION = "2026-08-07";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    throw redirect({ to: (roles ?? []).some((role) => role.role === "admin") ? "/admin" : "/dashboard" });
  },
  validateSearch: z.object({
    mode: z.enum(["signin", "signup", "forgot", "reset"]).optional(),
    code: z.string().optional(),
    token_hash: z.string().optional(),
    type: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — MyFixly" },
      { name: "description", content: "Sign in to MyFixly." },
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
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupStep, setSignupStep] = useState<"details" | "consent">("details");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [rememberedBiometricUser, setRememberedBiometricUser] = useState<Awaited<ReturnType<typeof getRememberedBiometricLogin>>>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    let mounted = true;

    // Check the device vault after the sign-in form is already visible. A
    // missing or unreadable native credential simply leaves password sign-in
    // available; it must never block the login screen.
    void Promise.all([getRememberedBiometricLogin(), biometricAuth.checkAvailability()])
      .then(([user, availability]) => {
        if (!mounted) return;
        setRememberedBiometricUser(availability.available ? user : null);
        setBiometricAvailable(availability.available);
      })
      .catch(() => {
        if (!mounted) return;
        setRememberedBiometricUser(null);
        setBiometricAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (signupStep === "details") {
          setSignupStep("consent");
          return;
        }

        if (!acceptedTerms || !acceptedPrivacy) {
          throw new Error("Please accept the Terms of Service and Privacy Policy to continue.");
        }

        const acceptedAt = new Date().toISOString();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            data: {
              full_name: fullName,
              acknowledgement_accepted: true,
              acknowledgement_accepted_at: acceptedAt,
              acknowledgement_version: ACKNOWLEDGEMENT_VERSION,
              terms_accepted: true,
              privacy_accepted: true,
            },
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

      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!signInData.user || !signInData.session) throw new Error("Your sign-in session could not be saved. Please try again.");

      // Use the session returned by the successful password login directly.
      // A second getUser()/getSession() call can fail or race on a native app,
      // which previously left fingerprint login with no session to restore.
      const savedBiometricLogin = await getRememberedBiometricLogin();
      const credentialInvalidated = await isBiometricCredentialInvalidated(signInData.user.id);
      if (signInData.user.user_metadata?.biometric_login_enabled === true && (credentialInvalidated || savedBiometricLogin?.userId !== signInData.user.id)) {
        // The preference can outlive a deleted/expired device credential. Do
        // not claim biometric login is active until Settings creates a new
        // verified Keystore record for this device.
        const { error: preferenceError } = await supabase.auth.updateUser({ data: { biometric_login_enabled: false } });
        if (preferenceError) throw preferenceError;
        setRememberedBiometricUser(null);
      } else if (signInData.user.user_metadata?.biometric_login_enabled === true) {
        await enableBiometricLogin(signInData.user, signInData.session);
        setRememberedBiometricUser({ userId: signInData.user.id, enabled: true });
      } else {
        setRememberedBiometricUser(null);
      }
      toast.success("Signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    const rememberedUser = rememberedBiometricUser;
    if (!rememberedUser) {
      toast.info("Fingerprint login is not enabled for this device. Please sign in with your password.");
      passwordInput.current?.focus();
      return;
    }

    setBiometricLoading(true);
    try {
      const availability = await biometricAuth.checkAvailability();
      if (!availability.available) {
        setBiometricAvailable(false);
        setRememberedBiometricUser(null);
        await biometricAuth.handleFailure({ success: false, reason: availability.reason });
        toast.info(availability.reason ?? "Fingerprint login is unavailable. Please sign in with your password.");
        passwordInput.current?.focus();
        return;
      }

      const result = await biometricAuth.authenticate();
      if (result.success) {
        const session = await biometricAuth.handleSuccess();
        if (session.user.id !== rememberedUser.userId) {
          throw new Error("This fingerprint is not linked to the selected account. Please sign in with your password.");
        }
        toast.success("Fingerprint verified. Signed in successfully.");
        navigate({ to: "/dashboard" });
        return;
      }

      await biometricAuth.handleFailure(result);
      toast.info(result.cancelled ? "Fingerprint login cancelled. Please sign in with your password." : (result.reason ?? "Fingerprint login failed. Please sign in with your password."));
      passwordInput.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fingerprint login could not be completed. Please sign in with your password.");
      passwordInput.current?.focus();
    } finally {
      setBiometricLoading(false);
    }
  }

  const title =
    mode === "signup" ? (signupStep === "consent" ? "User acknowledgement" : "Join MyFixly") : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Set a new password" : "Welcome back";

  const subtitle =
    mode === "signup"
      ? signupStep === "consent" ? "Review and accept these required terms to finish creating your account." : "Create your account to get started."
      : mode === "forgot"
        ? "Enter your email and we will send a recovery link."
        : mode === "reset"
          ? "Choose a new password for your account."
        : "Sign in to continue to your account.";

  // On native startup, wait for the Android Keystore-backed vault before
  // rendering password inputs. This allows the biometric prompt to be the
  // first sign-in interaction whenever a saved session is available.
  if (mode === "signin" && !biometricReady) {
    return (
      <div className="mx-auto flex min-h-[100svh] max-w-md items-center px-4 py-6 sm:py-10">
        <Card className="w-full border-border/80 shadow-elegant">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <p className="font-medium">Preparing secure sign-in…</p>
            <p className="text-sm text-muted-foreground">Checking this device for a saved fingerprint session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-md items-center px-4 py-6 sm:py-10">
      <Card className="w-full border-border/80 shadow-elegant">
        <CardHeader className="pb-5 pt-6 text-center sm:pt-7">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <Zap className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3 font-display text-2xl">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "signup" && (
            <div className="mb-6 space-y-2" aria-label="Registration progress">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Registration progress</span><span>{signupStep === "consent" ? "Step 2 of 2" : "Step 1 of 2"}</span>
              </div>
              <Progress value={signupStep === "consent" ? 90 : 50} />
              {signupStep === "consent" && <p className="text-xs text-muted-foreground">You&apos;re almost done.</p>}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && signupStep === "details" && (
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-9" placeholder="Your full name" />
                </div>
              </div>
            )}
            {signupStep !== "consent" && <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-9" placeholder="you@example.com" />
              </div>
            </div>}
            {(mode === "signin" || (mode === "signup" && signupStep === "details") || mode === "reset") && (
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
                    ref={passwordInput}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-11 pl-9"
                    placeholder={mode === "reset" ? "Enter a new password" : "At least 6 characters"}
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {mode === "signup" && signupStep === "consent" && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <div className="flex gap-3 text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Your trust and safety matter to us. Please review the following before continuing.</p></div>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>Provide accurate and truthful information.</li>
                  <li>Protect your account credentials and keep them confidential.</li>
                  <li>MyFixly connects customers with independent artisans.</li>
                  <li>Although we verify artisans where applicable, use reasonable judgment before hiring.</li>
                  <li>Biometric authentication only verifies identity on your device; MyFixly does not store fingerprint or facial biometric data on its servers.</li>
                  <li>Your information is collected and processed according to our Privacy Policy.</li>
                  <li>Comply with the Terms of Service while using MyFixly.</li>
                </ul>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-start gap-3"><Checkbox id="accept-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} aria-label="Accept Terms of Service" aria-required="true" /><span className="leading-5">I have read and agree to the <Link to="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>.</span></div>
                  <div className="flex items-start gap-3"><Checkbox id="accept-privacy" checked={acceptedPrivacy} onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)} aria-label="Acknowledge Privacy Policy" aria-required="true" /><span className="leading-5">I have read and understand the <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.</span></div>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full shadow-elegant" size="lg" disabled={loading || biometricLoading || (mode === "signup" && signupStep === "consent" && (!acceptedTerms || !acceptedPrivacy))}>
              {loading ? (
                <><LoaderCircle className="h-4 w-4 animate-spin" /> Please wait...</>
              )
                : mode === "signup"
                  ? signupStep === "consent" ? "Agree & Continue" : "Continue"
                  : mode === "forgot"
                    ? "Send recovery email"
                    : mode === "reset"
                      ? "Update password"
                      : "Sign in"}
            </Button>
            {mode === "signup" && signupStep === "consent" && <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={() => setSignupStep("details")}>Back to registration details</Button>}
            {mode === "signin" && biometricAvailable && rememberedBiometricUser && (
              <Button type="button" variant="outline" className="w-full border-primary/20 bg-primary/5 text-primary shadow-soft hover:bg-primary/10 hover:text-primary" size="lg" disabled={loading || biometricLoading} onClick={handleBiometricLogin}>
                <Fingerprint className="h-5 w-5" />
                {biometricLoading ? "Checking fingerprint..." : "Sign in with fingerprint"}
              </Button>
            )}
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
                setSignupStep("details");
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

