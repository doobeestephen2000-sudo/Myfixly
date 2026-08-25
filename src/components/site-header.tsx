import { Link, useNavigate } from "@tanstack/react-router";
import { CircleHelp, House, Info, LayoutDashboard, LogOut, Mail, Menu, Search, Settings, X, Zap, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

const publicNav = [{ to: "/", label: "Home", icon: House }, { to: "/mechanics", label: "Find Artisans", icon: Search }, { to: "/about", label: "About", icon: Info }, { to: "/faq", label: "Help", icon: CircleHelp }, { to: "/contact", label: "Contact", icon: Mail }] as const;
const memberNav = [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { to: "/mechanics", label: "Find Artisans", icon: Search }, { to: "/faq", label: "FAQ", icon: CircleHelp }, { to: "/contact", label: "Contact", icon: Mail }, { to: "/settings", label: "Settings", icon: Settings }] as const;
const artisanNav = [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { to: "/dashboard", label: "Job Requests", icon: ClipboardList }, { to: "/settings", label: "Settings", icon: Settings }, { to: "/contact", label: "Contact", icon: Mail }] as const;

export function SiteHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isArtisan, setIsArtisan] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = user ? (isArtisan ? artisanNav : memberNav) : publicNav;

  useEffect(() => {
    const setSession = async (session: { user: User } | null) => {
      setUser(session?.user ?? null);
      if (!session?.user) return setIsArtisan(false);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      setIsArtisan((data ?? []).some((row) => row.role === "artisan" || row.role === "mechanic"));
    };
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { void setSession(session); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (!error) await navigate({ to: "/auth" });
  }

  return <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="relative mx-auto flex min-h-16 max-w-7xl items-center px-4 py-2 sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="z-10 h-10 w-10 md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen}><Menu className="h-5 w-5" /></Button>
      <Link to="/" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 font-display text-lg font-bold md:static md:translate-x-0" aria-label="Myfixly home"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant"><Zap className="h-5 w-5" /></span><span className="text-foreground">Myfixly</span></Link>
      <nav className="ml-5 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex" aria-label="Primary navigation">{navigation.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active]:bg-primary/10 data-[active]:text-primary" activeProps={{ "data-active": "true" } as never} activeOptions={{ exact: item.to === "/" }}><Icon className="h-4 w-4" />{item.label}</Link>; })}</nav>
      <div className="ml-auto flex min-w-10 items-center justify-end gap-2">{user ? <Button asChild size="sm" className="hidden shadow-elegant md:inline-flex"><Link to="/dashboard">Open dashboard</Link></Button> : <><Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link to="/auth">Sign in</Link></Button><Button asChild size="sm" className="hidden shadow-elegant md:inline-flex"><Link to="/auth" search={{ mode: "signup" }}>Join</Link></Button></>}</div>
    </div>
    {menuOpen && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[2147483647] isolate md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <button className="absolute inset-0 z-0 bg-black/35" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
        <aside className="relative z-10 flex h-[100dvh] w-[min(21rem,88vw)] flex-col overflow-y-auto border-r border-border bg-background px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-foreground opacity-100 shadow-2xl [backdrop-filter:none] [filter:none]">
          <div className="flex items-center justify-between"><Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 font-display text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground"><Zap className="h-5 w-5" /></span><span>Myfixly</span></Link><Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu"><X className="h-5 w-5" /></Button></div>
          <nav className="mt-7 space-y-1" aria-label="Mobile navigation">{navigation.map((item) => { const Icon = item.icon; return <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><Icon className="h-5 w-5 text-primary" />{item.label}</Link>; })}{user && <button type="button" onClick={() => void signOut()} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><LogOut className="h-5 w-5 text-primary" />Sign Out</button>}</nav>
        </aside>
      </div>, document.body)}
  </header>;
}
