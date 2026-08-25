import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Zap } from "lucide-react";

import appCss from "../styles.css?url";

import { supabase } from "@/integrations/supabase/client";
import { isBiometricLoginEnabled, rememberBiometricSession } from "@/lib/biometric-auth";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { applyTheme, getStoredTheme } from "@/lib/theme";

const appBase = import.meta.env.BASE_URL || "/";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-colors hover:bg-primary/90">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          <a href={appBase} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Myfixly — Find verified generator mechanics in Nigeria" },
      { name: "description", content: "The trusted marketplace to find and hire verified generator mechanics for repair, installation, maintenance, and servicing across Nigeria." },
      { name: "author", content: "Myfixly" },
      { property: "og:title", content: "Myfixly — Verified generator mechanics near you" },
      { property: "og:description", content: "Find, contact, and hire trusted generator mechanics in your city. Repair, servicing, installation and maintenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: `${appBase}favicon.ico`, type: "image/x-icon" },
    ],
    scripts: [
      { src: "https://js.paystack.co/v1/inline.js", defer: true },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var d=localStorage.getItem('myfixly.theme')==='dark';document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()" }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAuthenticationRoute = pathname === "/auth";
  const showsMarketingFooter = ["/", "/about", "/faq", "/contact", "/terms", "/privacy", "/mechanics"].includes(pathname) || pathname.startsWith("/mechanics/");
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    let active = true;
    const fontsReady = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();

    // The app shell should always become interactive quickly. Font or auth
    // restoration can finish in the background instead of holding the splash.
    void Promise.race([
      Promise.all([supabase.auth.getSession(), fontsReady]),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ])
      .catch(() => undefined)
      .finally(() => {
        requestAnimationFrame(() => {
          if (active) setIsAppReady(true);
        });
      });

    return () => { active = false; };
  }, []);

  useEffect(() => { applyTheme(getStoredTheme()); }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session && isBiometricLoginEnabled(session.user)) {
        void rememberBiometricSession(session).catch((error) => console.error("[BiometricLogin] failed to persist the current session", error));
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    const syncSecureSession = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session && isBiometricLoginEnabled(data.session.user)) {
          return rememberBiometricSession(data.session);
        }
      }).catch((error) => console.error("[BiometricLogin] foreground session sync failed", error));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncSecureSession();
    };

    window.addEventListener("focus", syncSecureSession);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", syncSecureSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!isAppReady) return <AppBootSplash />;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-[100svh] flex-col pb-[env(safe-area-inset-bottom)]">
        {!isAuthenticationRoute && <SiteHeader />}
        <main className="min-w-0"><Outlet /></main>
        {showsMarketingFooter && <SiteFooter />}
      </div>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

function AppBootSplash() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-6" role="status" aria-label="Loading Myfixly">
      <div className="flex flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-hero text-primary-foreground shadow-elegant"><Zap className="h-8 w-8" /></div>
        <p className="mt-4 font-display text-lg font-bold text-foreground">Myfixly</p>
        <div className="mt-4 h-1.5 w-24 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-primary" /></div>
      </div>
    </div>
  );
}
