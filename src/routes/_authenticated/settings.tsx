import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Fingerprint, ShieldCheck, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  biometricAuth,
  clearRememberedBiometricSession,
  clearRememberedBiometricUser,
  enableBiometricLogin,
  isBiometricLoginEnabled,
} from "@/lib/biometric-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  type ThemePreference,
  getStoredTheme,
  setTheme,
} from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      throw redirect({ to: "/auth" });
    }

    return { user: data.user };
  },

  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useLoaderData();

  const [enabled, setEnabled] = useState(() =>
    isBiometricLoginEnabled(user)
  );

  const [saving, setSaving] = useState(false);

  const [theme, setThemePreference] = useState<ThemePreference>(() => {
    const storedTheme = getStoredTheme();

    return storedTheme === "dark" ? "dark" : "light";
  });

  function selectTheme(preference: "light" | "dark") {
    setTheme(preference);
    setThemePreference(preference);
  }

  async function updateBiometricPreference(nextEnabled: boolean) {
    setSaving(true);

    try {
      let session: Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >["data"]["session"] = null;

      if (nextEnabled) {
        const availability = await biometricAuth.checkAvailability();

        if (!availability.available) {
          throw new Error(
            availability.reason ??
              "Fingerprint authentication is not available on this device."
          );
        }

        const { data } = await supabase.auth.getSession();

        session = data.session;

        if (!session) {
          throw new Error(
            "Your sign-in session is no longer available. Please sign in again before enabling fingerprint login."
          );
        }
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          biometric_login_enabled: nextEnabled,
        },
      });

      if (error) {
        throw error;
      }

      if (nextEnabled) {
        if (!data.user || !session) {
          throw new Error(
            "Fingerprint setup could not confirm your current account."
          );
        }

        try {
          await enableBiometricLogin(data.user, session);
        } catch (storageError) {
          await supabase.auth.updateUser({
            data: {
              biometric_login_enabled: false,
            },
          });

          throw storageError;
        }
      } else {
        await clearRememberedBiometricSession();
        await clearRememberedBiometricUser();
      }

      setEnabled(nextEnabled);

      toast.success(
        nextEnabled
          ? "Fingerprint login enabled."
          : "Fingerprint login disabled."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update fingerprint login."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5">
        <h1 className="font-display text-3xl font-bold">Settings</h1>

        <p className="text-muted-foreground">
          Manage your sign-in preferences.
        </p>
      </div>

      {/* Fingerprint Login Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Fingerprint className="h-5 w-5" />
            </div>

            <div>
              <CardTitle className="dark:text-white">
                Enable Fingerprint Login
              </CardTitle>

              <CardDescription className="dark:text-slate-300">
                Use device biometrics to unlock your existing account session.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              Your password is never stored for fingerprint login.
            </span>
          </div>

          <Switch
            checked={enabled}
            onCheckedChange={updateBiometricPreference}
            disabled={saving}
            aria-label="Enable Fingerprint Login"
          />
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="dark:text-white">
            Appearance
          </CardTitle>

          <CardDescription className="dark:text-slate-300">
            Choose how MyFixly looks on this device.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Appearance preference"
          >
            <Button
              type="button"
              variant={theme === "light" ? "default" : "outline"}
              className="h-auto min-h-12 px-2 dark:border-slate-600 dark:text-white"
              onClick={() => selectTheme("light")}
              aria-pressed={theme === "light"}
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>

            <Button
              type="button"
              variant={theme === "dark" ? "default" : "outline"}
              className="h-auto min-h-12 px-2 dark:border-slate-600 dark:text-white"
              onClick={() => selectTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="mt-5">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
