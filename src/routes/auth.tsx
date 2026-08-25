import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Zap,
  Mail,
  Lock,
  User,
  Fingerprint,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  biometricAuth,
  enableBiometricLogin,
  getRememberedBiometricLogin,
  isBiometricCredentialInvalidated,
} from "@/lib/biometric-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

const ACKNOWLEDGEMENT_VERSION = "2026-08-07";

type AuthContinuation = "artisan-onboarding" | "customer-dashboard";

function appUrl(path: string) {
  // VITE_APP_URL is deployment-controlled. Falling back to the current URL
  // keeps browser-based local development working without hardcoding localhost.
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();
  const base = new URL(import.meta.env.BASE_URL || "/", configuredAppUrl || window.location.origin);
  return new URL(path.replace(/^\//, ""), base);
}

function authRedirectUrl(continuation: AuthContinuation) {
  const callback = appUrl("auth");
  callback.searchParams.set("next", continuation);
  return callback.toString();
}

export const Route = createFileRoute("/auth")({
  beforeLoad: async ({ search }) => {
    // Let the confirmation callback exchange or restore its session before
    // the normal signed-in redirect sends the user to the dashboard.
    if (search.next) return;

    const { data } = await supabase.auth.getUser();

    if (!data.user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    throw redirect({
      to: (roles ?? []).some((role) => role.role === "admin")
        ? "/admin"
        : "/dashboard",
    });
  },

  validateSearch: z.object({
    mode: z.enum(["signin", "signup", "forgot", "reset"]).optional(),
    code: z.string().optional(),
    token_hash: z.string().optional(),
    type: z.string().optional(),
    next: z.enum(["artisan-onboarding", "customer-dashboard"]).optional(),
  }),

  head: () => ({
    meta: [
      { title: "Sign in — Myfixly" },
      {
        name: "description",
        content: "Sign in to Myfixly.",
      },
    ],
  }),

  component: Auth,
});

function Auth() {
  const {
    mode: initialMode,
    code,
    token_hash,
    type,
    next,
  } = Route.useSearch();

  const [mode, setMode] = useState<
    "signin" | "signup" | "forgot" | "reset"
  >(initialMode ?? "signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [accountType, setAccountType] = useState<"customer" | "artisan">("customer");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [signupStep, setSignupStep] = useState<
    "details" | "consent"
  >("details");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const [rememberedBiometricUser, setRememberedBiometricUser] =
    useState<Awaited<ReturnType<typeof getRememberedBiometricLogin>>>(null);

  const passwordInput = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const completeAuthCallback = async () => {
      const recoveryType = type ?? "";

      const hasAuthTicket = Boolean(
        code ||
          token_hash ||
          recoveryType === "recovery"
      );

      if (!hasAuthTicket) {
        // Some Supabase projects use an implicit-flow confirmation link. The
        // client restores that session from the URL fragment before this runs.
        if (next) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            navigate({ to: next === "artisan-onboarding" ? "/register-mechanic" : "/dashboard", replace: true });
          }
        }
        return;
      }

      try {
        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;
        }

        if (token_hash) {
          const { error } =
            await supabase.auth.verifyOtp({
              token_hash: token_hash,
              type: "recovery",
            });

          if (error) throw error;
        }

        if (next === "artisan-onboarding") {
          toast.success("Email confirmed. Continue your artisan registration.");
          navigate({ to: "/register-mechanic", replace: true });
          return;
        }

        if (next === "customer-dashboard") {
          toast.success("Email confirmed. Your account is ready.");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        if (recoveryType !== "recovery" && !token_hash) {
          throw new Error("This confirmation link is missing a valid Myfixly continuation.");
        }

        setMode("reset");

        toast.success(
          "Recovery link verified. Set a new password below."
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Recovery link could not be verified."
        );

        setMode("forgot");
      }
    };

    void completeAuthCallback();
  }, [code, token_hash, type, next, navigate]);

  useEffect(() => {
    let mounted = true;

    // This is optional convenience functionality. It must never prevent a
    // password sign-in form from becoming available.
    void Promise.race([
      Promise.all([
        getRememberedBiometricLogin(),
        biometricAuth.checkAvailability(),
      ]).then(([user, availability]) => ({ user, availability })),
      new Promise<{ user: null; availability: { available: false } }>((resolve) => {
        window.setTimeout(
          () => resolve({ user: null, availability: { available: false } }),
          1500,
        );
      }),
    ])
      .then(({ user, availability }) => {
        if (!mounted) return;

        setRememberedBiometricUser(
          availability.available ? user : null
        );

        setBiometricAvailable(
          availability.available
        );
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

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);

    try {
      if (mode === "signup") {
        if (signupStep === "details") {
          if (!phone.trim() || !gender) {
            throw new Error("Phone number and gender are required.");
          }
          setSignupStep("consent");
          return;
        }

        if (!acceptedTerms || !acceptedPrivacy) {
          throw new Error(
            "Please accept the Terms of Service and Privacy Policy to continue."
          );
        }

        const acceptedAt =
          new Date().toISOString();

        const { data: signupData, error } =
          await supabase.auth.signUp({
            email,
            password,

            options: {
              emailRedirectTo: authRedirectUrl(
                accountType === "artisan" ? "artisan-onboarding" : "customer-dashboard",
              ),

              data: {
                full_name: fullName,
                phone: phone.trim(),
                gender,
                account_type: accountType,
                acknowledgement_accepted: true,
                acknowledgement_accepted_at: acceptedAt,
                acknowledgement_version:
                  ACKNOWLEDGEMENT_VERSION,
                terms_accepted: true,
                privacy_accepted: true,
              },
            },
          });

        if (error) throw error;

        if (!signupData.session) {
          toast.success("Account created. Check your email to confirm your account and continue registration.");
          // Sign-in must not inherit the signup acknowledgement step. Doing so
          // hid the identifier input while leaving the password field visible.
          setSignupStep("details");
          setMode("signin");
          return;
        }

        toast.success("Account created! Redirecting to complete your profile...");

        navigate({ to: accountType === "artisan" ? "/register-mechanic" : "/dashboard" });

        return;
      }

      if (mode === "forgot") {
        const redirectUrl = appUrl("auth?mode=reset").toString();

        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email,
            {
              redirectTo: redirectUrl,
            }
          );

        if (error) throw error;

        setResetSent(true);

        toast.success(
          "Password reset email sent. Check your inbox."
        );

        return;
      }

      if (mode === "reset") {
        const { error } =
          await supabase.auth.updateUser({
            password,
          });

        if (error) throw error;

        toast.success(
          "Password updated successfully."
        );

        navigate({
          to: "/dashboard",
        });

        return;
      }

      const identifier = email.trim();
      if (!identifier) throw new Error("Please enter your email or phone number.");
      if (!password) throw new Error("Please enter your password.");

      const isEmailIdentifier = identifier.includes("@");
      let signInData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"];
      let error: Error | null = null;

      if (isEmailIdentifier) {
        const result = await supabase.auth.signInWithPassword({ email: identifier, password });
        signInData = result.data;
        error = result.error;
      } else {
        // Phone numbers live in profiles, not Supabase Auth. The Edge Function
        // resolves and verifies the password server-side without exposing an
        // account lookup to the browser.
        const { data, error: phoneError } = await supabase.functions.invoke("phone-password-login", {
          body: { phone: identifier, password },
        });
        if (phoneError || !data?.access_token || !data?.refresh_token) {
          throw new Error("Incorrect email/phone number or password.");
        }
        const restored = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        signInData = restored.data;
        error = restored.error;
      }

      if (error) throw error;

      if (
        !signInData.user ||
        !signInData.session
      ) {
        throw new Error(
          "Your sign-in session could not be saved. Please try again."
        );
      }

      // Use the session returned directly from the
      // successful password login.
      const savedBiometricLogin =
        await getRememberedBiometricLogin();

      const credentialInvalidated =
        await isBiometricCredentialInvalidated(
          signInData.user.id
        );

      if (
        signInData.user.user_metadata
          ?.biometric_login_enabled === true &&
        (
          credentialInvalidated ||
          savedBiometricLogin?.userId !==
            signInData.user.id
        )
      ) {
        const {
          error: preferenceError,
        } =
          await supabase.auth.updateUser({
            data: {
              biometric_login_enabled: false,
            },
          });

        if (preferenceError)
          throw preferenceError;

        setRememberedBiometricUser(null);
      } else if (
        signInData.user.user_metadata
          ?.biometric_login_enabled === true
      ) {
        await enableBiometricLogin(
          signInData.user,
          signInData.session
        );

        setRememberedBiometricUser({
          userId: signInData.user.id,
          enabled: true,
        });
      } else {
        setRememberedBiometricUser(null);
      }

      toast.success("Signed in");

      navigate({
        to: "/dashboard",
      });
    } catch (err) {
      toast.error(mode === "signin"
        ? (err instanceof Error && err.message.startsWith("Please enter")
          ? err.message
          : "Incorrect email/phone number or password.")
        : (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    const rememberedUser =
      rememberedBiometricUser;

    if (!rememberedUser) {
      toast.info(
        "Fingerprint login is not enabled for this device. Please sign in with your password."
      );

      passwordInput.current?.focus();

      return;
    }

    setBiometricLoading(true);

    try {
      const availability =
        await biometricAuth.checkAvailability();

      if (!availability.available) {
        setBiometricAvailable(false);
        setRememberedBiometricUser(null);

        await biometricAuth.handleFailure({
          success: false,
          reason: availability.reason,
        });

        toast.info(
          availability.reason ??
            "Fingerprint login is unavailable. Please sign in with your password."
        );

        passwordInput.current?.focus();

        return;
      }

      const result =
        await biometricAuth.authenticate();

      if (result.success) {
        const session =
          await biometricAuth.handleSuccess();

        if (
          session.user.id !==
          rememberedUser.userId
        ) {
          throw new Error(
            "This fingerprint is not linked to the selected account. Please sign in with your password."
          );
        }

        toast.success(
          "Fingerprint verified. Signed in successfully."
        );

        navigate({
          to: "/dashboard",
        });

        return;
      }

      await biometricAuth.handleFailure(
        result
      );

      toast.info(
        result.cancelled
          ? "Fingerprint login cancelled. Please sign in with your password."
          : (
              result.reason ??
              "Fingerprint login failed. Please sign in with your password."
            )
      );

      passwordInput.current?.focus();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Fingerprint login could not be completed. Please sign in with your password."
      );

      passwordInput.current?.focus();
    } finally {
      setBiometricLoading(false);
    }
  }

  const title =
    mode === "signup"
      ? (
          signupStep === "consent"
            ? "User acknowledgement"
            : "Join Myfixly"
        )
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Set a new password"
          : "Welcome back";

  const subtitle =
    mode === "signup"
      ? (
          signupStep === "consent"
            ? "Review and accept these required terms to finish creating your account."
            : "Create your account to get started."
        )
      : mode === "forgot"
        ? "Enter your email and we will send a recovery link."
        : mode === "reset"
          ? "Choose a new password for your account."
          : "Sign in to continue to your account.";

  return (
    <div className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-gradient-subtle px-4 py-6 sm:py-10">
      <div className="pointer-events-none absolute -left-28 top-4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <Card className="relative w-full max-w-md border-border/80 bg-card/95 shadow-elegant backdrop-blur">

        <CardHeader className="pb-6 pt-8 text-center sm:pt-9">

          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[1.125rem] bg-gradient-hero text-primary-foreground shadow-elegant">
            <Zap className="h-7 w-7" />
          </div>

          <p className="mt-4 font-display text-sm font-bold tracking-[0.18em] text-primary">Myfixly</p>

          <CardTitle className="mt-1 font-display text-3xl leading-tight">
            {title}
          </CardTitle>

          <CardDescription className="mx-auto mt-2 max-w-xs leading-6">
            {subtitle}
          </CardDescription>

        </CardHeader>

        <CardContent className="px-5 pb-7 sm:px-7 sm:pb-8 [&_input]:h-12 [&_input]:rounded-xl [&_input]:border-border/90 [&_input]:bg-background/70 [&_input]:px-10 [&_label]:text-sm [&_label]:font-medium">

          {mode === "signup" && (
            <div
              className="mb-6 space-y-2"
              aria-label="Registration progress"
            >
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  Registration progress
                </span>

                <span>
                  {signupStep === "consent"
                    ? "Step 2 of 2"
                    : "Step 1 of 2"}
                </span>
              </div>

              <Progress
                value={
                  signupStep === "consent"
                    ? 90
                    : 50
                }
              />

              {signupStep === "consent" && (
                <p className="text-xs text-muted-foreground">
                  You&apos;re almost done.
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            {mode === "signup" &&
              signupStep === "details" && (
                <>
                <div>
                  <Label htmlFor="fullName">
                    Full name
                  </Label>

                  <div className="relative mt-1">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) =>
                        setFullName(
                          e.target.value
                        )
                      }
                      required
                      className="pl-9"
                      placeholder="Your full name"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">Phone number</Label>
                    <div className="relative mt-1"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="pl-9" placeholder="Your phone number" /></div>
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <select id="gender" value={gender} onChange={(e) => setGender(e.target.value as "male" | "female" | "")} required className="mt-1 flex h-12 w-full rounded-xl border border-border/90 bg-background/70 px-3 text-sm"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select>
                  </div>
                </div>
                <fieldset className="space-y-2"><legend className="text-sm font-medium">Account type</legend><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAccountType("customer")} className={`rounded-xl border p-3 text-left text-sm ${accountType === "customer" ? "border-primary bg-primary/10" : "border-border"}`}><b>Customer</b><br /><span className="text-xs text-muted-foreground">Find and request artisans</span></button><button type="button" onClick={() => setAccountType("artisan")} className={`rounded-xl border p-3 text-left text-sm ${accountType === "artisan" ? "border-primary bg-primary/10" : "border-border"}`}><b>Artisan</b><br /><span className="text-xs text-muted-foreground">Offer professional services</span></button></div></fieldset>
                </>
              )}

            {(mode !== "signup" || signupStep !== "consent") && (
              <div>
                <Label htmlFor="email">
                  {mode === "signin" ? "Email / Phone Number" : "Email"}
                </Label>

                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="email"
                    type={mode === "signin" ? "text" : "email"}
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    required
                    className="pl-9"
                    placeholder={mode === "signin" ? "you@example.com or 08012345678" : "you@example.com"}
                  />
                </div>
              </div>
            )}

            {(mode === "signin" ||
              (mode === "signup" &&
                signupStep === "details") ||
              mode === "reset") && (
              <div>

                <div className="mb-1 flex items-center justify-between">

                  <Label htmlFor="password">
                    {mode === "reset"
                      ? "New password"
                      : "Password"}
                  </Label>

                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        setMode("forgot")
                      }
                    >
                      Forgot password?
                    </button>
                  )}

                </div>

                <div className="relative mt-1">

                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="password"
                    ref={passwordInput}
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    required
                    minLength={6}
                    className="pr-11 pl-9"
                    placeholder={
                      mode === "reset"
                        ? "Enter a new password"
                        : "At least 6 characters"
                    }
                  />

                  <button
                    type="button"
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setShowPassword(
                        (visible) =>
                          !visible
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={
                      showPassword
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                </div>
              </div>
            )}

            {mode === "signup" &&
              signupStep === "consent" && (
                <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">

                  <div className="flex gap-3 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                    <p>
                      Your trust and safety matter
                      to us. Please review the
                      following before continuing.
                    </p>
                  </div>

                  <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                    <li>
                      Provide accurate and truthful
                      information.
                    </li>

                    <li>
                      Protect your account credentials
                      and keep them confidential.
                    </li>

                    <li>
                      Myfixly connects customers with
                      independent artisans.
                    </li>

                    <li>
                      Although we verify artisans
                      where applicable, use reasonable
                      judgment before hiring.
                    </li>

                    <li>
                      Biometric authentication only
                      verifies identity on your device;
                      Myfixly does not store fingerprint
                      or facial biometric data on its
                      servers.
                    </li>

                    <li>
                      Your information is collected and
                      processed according to our Privacy
                      Policy.
                    </li>

                    <li>
                      Comply with the Terms of Service
                      while using Myfixly.
                    </li>
                  </ul>

                  <div className="space-y-3 border-t border-border pt-4">

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="accept-terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) =>
                          setAcceptedTerms(
                            checked === true
                          )
                        }
                        aria-label="Accept Terms of Service"
                        aria-required="true"
                      />

                      <span className="leading-5">
                        I have read and agree to the{" "}
                        <Link
                          to="/terms"
                          className="font-medium text-primary hover:underline"
                        >
                          Terms of Service
                        </Link>
                        .
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="accept-privacy"
                        checked={acceptedPrivacy}
                        onCheckedChange={(checked) =>
                          setAcceptedPrivacy(
                            checked === true
                          )
                        }
                        aria-label="Acknowledge Privacy Policy"
                        aria-required="true"
                      />

                      <span className="leading-5">
                        I have read and understand the{" "}
                        <Link
                          to="/privacy"
                          className="font-medium text-primary hover:underline"
                        >
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </div>

                  </div>
                </div>
              )}

            <Button
              type="submit"
              className="w-full rounded-xl font-semibold shadow-elegant"
              size="lg"
              disabled={
                loading ||
                biometricLoading ||
                (
                  mode === "signup" &&
                  signupStep === "consent" &&
                  (
                    !acceptedTerms ||
                    !acceptedPrivacy
                  )
                )
              }
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : mode === "signup" ? (
                signupStep === "consent"
                  ? "Agree & Continue"
                  : "Continue"
              ) : mode === "forgot" ? (
                "Send recovery email"
              ) : mode === "reset" ? (
                "Update password"
              ) : (
                "Sign in"
              )}
            </Button>

            {mode === "signup" &&
              signupStep === "consent" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={loading}
                  onClick={() =>
                    setSignupStep("details")
                  }
                >
                  Back to registration details
                </Button>
              )}

            {mode === "signin" &&
              biometricAvailable &&
              rememberedBiometricUser && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                    <span>or use your device</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-xl border-primary/25 bg-primary/5 font-semibold text-primary shadow-soft hover:bg-primary/10 hover:text-primary"
                    disabled={loading || biometricLoading}
                    onClick={handleBiometricLogin}
                  >
                    <Fingerprint className="h-5 w-5" />
                    {biometricLoading ? "Checking fingerprint..." : "Sign in with fingerprint"}
                  </Button>
                </div>
              )}

          </form>

          {resetSent &&
            mode === "forgot" && (
              <p className="mt-3 text-center text-sm text-emerald-600">
                Recovery email sent. You can
                close this tab and return when
                you receive it.
              </p>
            )}

          <p className="mt-4 text-center text-sm text-muted-foreground">

            {mode === "signup"
              ? "Already have an account? "
              : mode === "forgot"
                ? "Remember your password? "
                : mode === "reset"
                  ? "Need to sign in instead? "
                  : "Need an account? "}

            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setResetSent(false);
                setSignupStep("details");

                setMode(
                  mode === "signup"
                    ? "signin"
                    : mode === "forgot"
                      ? "signin"
                      : mode === "reset"
                        ? "signin"
                        : "signup"
                );
              }}
            >
              {mode === "signup"
                ? "Sign in"
                : mode === "forgot"
                  ? "Back to sign in"
                  : mode === "reset"
                    ? "Sign in"
                    : "Create account"}
            </button>

          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link
              to="/"
              className="hover:underline"
            >
              ← Back to home
            </Link>
          </p>

        </CardContent>
      </Card>
    </div>
  );
}
