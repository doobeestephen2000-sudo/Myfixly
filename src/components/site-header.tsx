import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Home" },
  { to: "/mechanics", label: "Find Artisans" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const syncUser = (nextUser: User | null) => setUser(nextUser);

    supabase.auth.getSession().then(({ data }) => syncUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      syncUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <Zap className="h-5 w-5" />
          </span>
          <span>
            <span className="text-primary">My</span>
            <span className="text-foreground">Fixly</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active]:text-primary"
              activeProps={{ "data-active": "true" } as never}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button asChild size="sm"><Link to="/dashboard">Dashboard</Link></Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm" className="shadow-elegant"><Link to="/auth" search={{ mode: "signup" }}>Register</Link></Button>
            </>
          )}
        </div>

        <button
          className="rounded-xl p-2 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-border/60 bg-background/98 shadow-card md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent data-[active]:bg-primary/10 data-[active]:text-primary" activeProps={{ "data-active": "true" } as never} activeOptions={{ exact: n.to === "/" }}>
                {n.label}
              </Link>
            ))}
            <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2">
              {user ? (
                <>
                  <Button asChild size="lg" className="w-full shadow-elegant"><Link to="/dashboard">Dashboard</Link></Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="lg" className="w-full"><Link to="/auth">Sign in</Link></Button>
                  <Button asChild size="lg" className="w-full shadow-elegant"><Link to="/auth" search={{ mode: "signup" }}>Register</Link></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
