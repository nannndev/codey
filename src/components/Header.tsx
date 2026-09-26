import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Flame,
  Gamepad2,
  Headphones,
  Heart,
  Keyboard,
  LogIn,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  SlidersHorizontal,
  Swords,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "./AuthProvider";
import { usePreferences } from "./PreferencesProvider";
import { useFlowRadio } from "./RadioProvider";
import { ThemeStudioModal } from "./ThemeStudioModal";
import { isMac, openCommandPalette } from "./CommandPalette";
import { cn } from "@/lib/utils";

const SoundPackModal = lazy(() => import("./SoundPackModal").then((module) => ({ default: module.SoundPackModal })));

const NAV: { to: string; label: string; icon: LucideIcon; title: string }[] = [
  { to: "/duel", label: "Duel", icon: Swords, title: "1v1 live code race" },
  { to: "/arcade", label: "Arcade", icon: Gamepad2, title: "Code Rain Arcade" },
  { to: "/daily", label: "Daily", icon: CalendarDays, title: "Daily Challenge" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, title: "Global ranked leaderboard" },
  { to: "/analytics/keyboard", label: "Analytics", icon: Keyboard, title: "Keyboard analytics" },
];

const iconButton =
  "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer";

/** A small anchored popover that closes on outside click, Escape or selection. */
function HeaderMenu({ label, trigger, triggerClassName, children }: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(triggerClassName ?? iconButton, open && "bg-muted text-foreground")}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
      >
        {trigger}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 animate-scale-in rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, to, trailing, className }: {
  icon: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const classes = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer",
    className
  );
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </>
  );
  return to ? (
    <Link role="menuitem" to={to} onClick={onClick} className={classes}>{body}</Link>
  ) : (
    <button role="menuitem" type="button" onClick={onClick} className={classes}>{body}</button>
  );
}

function OnOff({ on }: { on: boolean }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold", on ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
      {on ? "ON" : "OFF"}
    </span>
  );
}

export function Header() {
  const location = useLocation();
  const radio = useFlowRadio();
  const { user, loading, configured, login, logout } = useAuth();
  const { preferences, setPreference } = usePreferences();
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const toolItems = (close: () => void) => (
    <>
      <MenuItem icon={Palette} onClick={() => { close(); setShowThemeModal(true); }}>Theme Studio</MenuItem>
      <MenuItem icon={Volume2} onClick={() => { close(); setShowSoundModal(true); }}>Switch sounds</MenuItem>
      <MenuItem icon={Headphones} onClick={radio.togglePlay} trailing={<OnOff on={radio.isPlaying} />}>Flow radio</MenuItem>
      <MenuItem icon={Flame} onClick={() => setPreference("comboEffects", !preferences.comboEffects)} trailing={<OnOff on={preferences.comboEffects} />}>
        Combo effects
      </MenuItem>
      <div className="my-1 h-px bg-border" />
      <MenuItem icon={BarChart3} to="/history" onClick={close}>History</MenuItem>
      <MenuItem icon={Settings} to="/settings" onClick={close}>Settings</MenuItem>
      <MenuItem icon={Users} to="/contributors" onClick={close}>Contributors</MenuItem>
      <MenuItem icon={Heart} to="/donate" onClick={close} className="text-amber-600 dark:text-amber-400">Support Codey</MenuItem>
    </>
  );

  return (
    <header className="sticky top-4 z-40 mb-8">
      <div className="glass-card rounded-2xl px-3 py-2 shadow-lg shadow-black/5 transition-all duration-300">
        {/* Three zones: brand | primary nav (centered) | actions. The outer
            columns share the leftover space equally so the nav stays centered. */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Link to="/" className="group flex min-w-0 items-center gap-2 justify-self-start" title="Codey - Home">
            <div className="logo-mark flex size-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 shadow-xs transition-colors group-hover:border-amber-500/50">
              <img src="/favicon.svg" alt="" className="size-4.5 transition-transform group-hover:rotate-6" />
            </div>
            <span className="text-base font-black tracking-tight text-foreground">Codey</span>
          </Link>

          <nav className="hidden items-center gap-0.5 rounded-xl border border-border/60 bg-background/50 p-1 lg:flex" aria-label="Primary">
            {NAV.map(({ to, label, icon: Icon, title }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  title={title}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors xl:px-3",
                    active ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0 xl:size-3.5", !active && to === "/duel" && "text-amber-500")} />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center justify-self-end gap-1">
            <button
              type="button"
              onClick={openCommandPalette}
              className={cn(iconButton, "hidden sm:grid")}
              aria-label="Open command palette"
              title={`Search and commands (${isMac() ? "⌘K" : "Ctrl K"})`}
            >
              <Search className="size-4" />
            </button>

            <div className="hidden md:block">
              <HeaderMenu label="Tools" trigger={<SlidersHorizontal className="size-4" />}>{toolItems}</HeaderMenu>
            </div>

            <ThemeToggle />

            {configured && (user ? (
              <HeaderMenu
                label="Account"
                triggerClassName="ml-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-black text-zinc-950 ring-2 ring-amber-500/25 transition-shadow hover:ring-amber-500/50 cursor-pointer"
                trigger={initial}
              >
                {(close) => (
                  <>
                    <div className="px-2.5 pb-2 pt-1.5">
                      <p className="truncate text-sm font-semibold">{user.name || "Typist"}</p>
                      {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                    </div>
                    <div className="mb-1 h-px bg-border" />
                    <MenuItem icon={UserRound} to="/profile" onClick={close}>Profile</MenuItem>
                    <MenuItem icon={BarChart3} to="/history" onClick={close}>History</MenuItem>
                    <div className="my-1 h-px bg-border" />
                    <MenuItem icon={LogOut} onClick={() => { close(); void logout(); }} className="text-destructive">Sign out</MenuItem>
                  </>
                )}
              </HeaderMenu>
            ) : (
              <button
                type="button"
                onClick={login}
                disabled={loading}
                className="ml-0.5 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                <LogIn className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap">{loading ? "Checking…" : "Sign in"}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(iconButton, "lg:hidden")}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-2 grid animate-fade-in-up grid-cols-2 gap-1.5 border-t border-border/50 pt-2 lg:hidden">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-colors",
                  isActive(to) ? "border-foreground bg-foreground text-background" : "border-border/50 bg-card/70 text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            ))}
            <div className="col-span-2 mt-1 rounded-xl border border-border/50 bg-card/70 p-1 md:hidden">
              {toolItems(() => setMobileMenuOpen(false))}
            </div>
          </div>
        )}
      </div>

      {showSoundModal && (
        <Suspense fallback={null}>
          <SoundPackModal isOpen onClose={() => setShowSoundModal(false)} />
        </Suspense>
      )}
      <ThemeStudioModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </header>
  );
}
