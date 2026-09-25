import { useState } from "react";
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
  Swords,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useAuth } from "./AuthProvider";
import { usePreferences } from "./PreferencesProvider";
import { useFlowRadio } from "./RadioProvider";
import { SoundPackModal } from "./SoundPackModal";
import { ThemeStudioModal } from "./ThemeStudioModal";
import { isMac, openCommandPalette } from "./CommandPalette";
import { cn } from "@/lib/utils";

export function Header() {
  const location = useLocation();
  const radio = useFlowRadio();
  const { user, loading, configured, login, logout } = useAuth();
  const { preferences, setPreference } = usePreferences();
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-4 z-40 mb-8">
      <div className="glass-card rounded-2xl px-4 py-2.5 shadow-lg shadow-black/5 transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          {/* Left Group: Brand Logo & Navigation Links */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <Link to="/" className="group flex items-center gap-2 transition-transform hover:scale-[1.02] shrink-0" title="Codey - Home">
              <div className="logo-mark size-8 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/25 text-amber-500 shadow-xs group-hover:border-amber-500/50 transition-colors">
                <img src="/favicon.svg" alt="" className="size-4.5 transition-transform group-hover:rotate-6" />
              </div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-base font-black tracking-tight text-foreground font-sans">Codey</span>
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
            </Link>

            {/* Subtle Divider */}
            <div className="hidden lg:block h-4 w-px bg-border/60 mx-0.5 shrink-0" />

            {/* Primary Nav Links (Grouped on Left) */}
            <nav className="hidden lg:flex items-center gap-1 glass-pill rounded-xl p-1 shadow-inner shrink-0 whitespace-nowrap">
              <Link
                to="/duel"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150",
                  isActive("/duel")
                    ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                    : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                )}
                title="1v1 Live Real-time Code Race"
              >
                <Swords className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap leading-none">1v1 Duel</span>
                <span className="size-1.5 rounded-full bg-amber-400 animate-ping hidden xl:inline-block shrink-0" />
              </Link>

              <Link
                to="/arcade"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150",
                  isActive("/arcade")
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title="Code Rain Arcade"
              >
                <Gamepad2 className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap leading-none">Arcade</span>
              </Link>

              <Link
                to="/daily"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150",
                  isActive("/daily")
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title="Daily Challenge"
              >
                <CalendarDays className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap leading-none">Daily</span>
              </Link>

              <Link
                to="/leaderboard"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150",
                  isActive("/leaderboard")
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title="Global Ranked Leaderboard"
              >
                <Trophy className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap leading-none">Leaderboard</span>
              </Link>

              <Link
                to="/analytics/keyboard"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150",
                  isActive("/analytics/keyboard")
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title="Keyboard Heatmap & Typing Telemetry"
              >
                <Keyboard className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap leading-none">Analytics</span>
              </Link>
            </nav>
          </div>

          {/* Quick Tools & Profile (Right side) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Tools pill (Theme, Sound, History, Settings) */}
          <div className="hidden md:flex items-center gap-0.5 rounded-xl border border-border/50 bg-background/50 p-0.5 shrink-0">
            <button
              type="button"
              onClick={openCommandPalette}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
              aria-label="Open command palette"
              title="Command palette"
            >
              <Search className="size-4" />
              <kbd className="hidden lg:inline font-mono text-[10px] font-semibold">{isMac() ? "⌘K" : "Ctrl K"}</kbd>
            </button>

            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
              aria-label="Theme Studio"
              title="IDE Theme Studio & Syntax Highlighter"
            >
              <Palette className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowSoundModal(true)}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
              aria-label="Sound Engine"
              title="Mechanical Switch Sound Engine"
            >
              <Volume2 className="size-4" />
            </button>

            <button
              type="button"
              onClick={radio.togglePlay}
              className={cn(
                "rounded-lg p-2 transition-colors shrink-0 cursor-pointer",
                radio.isPlaying
                  ? "text-amber-500 bg-amber-500/15 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="Flow State Radio"
              title={
                radio.isPlaying
                  ? `Flow Radio: Playing (${radio.stationInfo.name}) - Click to Pause`
                  : "Flow Radio: Click to Play Ambient Lo-Fi / Synthwave"
              }
            >
              <Headphones className={cn("size-4", radio.isPlaying && "animate-pulse")} />
            </button>

            <button
              type="button"
              onClick={() => setPreference("comboEffects", !preferences.comboEffects)}
              className={cn(
                "rounded-lg p-2 transition-colors shrink-0 cursor-pointer",
                preferences.comboEffects
                  ? "text-amber-500 hover:bg-amber-500/10"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="Toggle Combo Sparks"
              title={preferences.comboEffects ? "Combo Sparks & Glow: ON (Click to disable)" : "Combo Sparks & Glow: OFF (Click to enable)"}
            >
              <Flame className="size-4" />
            </button>

            <Link
              to="/history"
              className={cn(
                "rounded-lg p-2 transition-colors shrink-0",
                isActive("/history") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="History"
              title="Typing Run History"
            >
              <BarChart3 className="size-4" />
            </Link>

            <Link
              to="/settings"
              className={cn(
                "rounded-lg p-2 transition-colors shrink-0",
                isActive("/settings") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="Settings"
              title="Settings & Preferences"
            >
              <Settings className="size-4" />
            </Link>
          </div>

          {/* Support / Donate */}
          <Link
            to="/donate"
            className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 border border-amber-500/25 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/40",
              isActive("/donate") && "bg-amber-500/25 border-amber-500/50"
            )}
            title="Support Codey development"
          >
            <Heart className="size-3.5 fill-current animate-pulse shrink-0" />
            <span className="hidden 2xl:inline whitespace-nowrap">Donate</span>
          </Link>

            {/* Theme Toggle */}
            <div className="border-l border-border/40 pl-1.5 ml-0.5 shrink-0">
              <ThemeToggle />
            </div>

            {/* Auth / Profile */}
            {configured && (
              <div className="flex items-center pl-0.5 shrink-0">
                {user ? (
                  <div className="flex items-center gap-0.5 rounded-xl border border-border/50 bg-background/50 p-0.5 shrink-0">
                    <Link
                      to="/profile"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold hover:bg-muted transition-colors max-w-[110px] whitespace-nowrap shrink-0"
                      aria-label="Open profile"
                    >
                      <UserRound className="size-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{user.name || "Profile"}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                      aria-label="Sign out"
                      title="Sign out"
                    >
                      <LogOut className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={login}
                    disabled={loading}
                    className="h-8 gap-1.5 rounded-xl border-border/70 text-xs font-semibold hover:border-foreground/30 shadow-xs shrink-0"
                  >
                    <LogIn className="size-3.5 text-amber-500 shrink-0" />
                    <span className="whitespace-nowrap">{loading ? "Checking..." : "GitHub Sign in"}</span>
                  </Button>
                )}
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden size-8 grid place-items-center rounded-xl border border-border/50 bg-background/50 text-foreground transition-colors hover:bg-muted"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 animate-fade-in-up">
            <Link
              to="/duel"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all",
                isActive("/duel") ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-card/70 border-border/40 text-foreground"
              )}
            >
              <Swords className="size-4 text-amber-500" />
              <span>1v1 Duel</span>
            </Link>

            <Link
              to="/arcade"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all",
                isActive("/arcade") ? "bg-primary/20 border-primary/40 text-primary" : "bg-card/70 border-border/40 text-foreground"
              )}
            >
              <Gamepad2 className="size-4" />
              <span>Arcade</span>
            </Link>

            <Link
              to="/daily"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all",
                isActive("/daily") ? "bg-primary/20 border-primary/40 text-primary" : "bg-card/70 border-border/40 text-foreground"
              )}
            >
              <CalendarDays className="size-4 text-amber-500" />
              <span>Daily</span>
            </Link>

            <Link
              to="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all",
                isActive("/leaderboard") ? "bg-primary/20 border-primary/40 text-primary" : "bg-card/70 border-border/40 text-foreground"
              )}
            >
              <Trophy className="size-4 text-amber-500" />
              <span>Leaderboard</span>
            </Link>

            <Link
              to="/analytics/keyboard"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all",
                isActive("/analytics/keyboard") ? "bg-primary/20 border-primary/40 text-primary" : "bg-card/70 border-border/40 text-foreground"
              )}
            >
              <Keyboard className="size-4" />
              <span>Analytics</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowThemeModal(true);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground text-left"
            >
              <Palette className="size-4 text-amber-500" />
              <span>Themes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowSoundModal(true);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground text-left"
            >
              <Volume2 className="size-4 text-amber-500" />
              <span>Sound Pack</span>
            </button>

            <button
              type="button"
              onClick={() => setPreference("comboEffects", !preferences.comboEffects)}
              className="flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground text-left"
            >
              <span className="flex items-center gap-2">
                <Flame className={cn("size-4", preferences.comboEffects ? "text-amber-500" : "text-muted-foreground")} />
                <span>Combo Sparks</span>
              </span>
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-md border", preferences.comboEffects ? "bg-amber-500/15 border-amber-500/30 text-amber-500" : "bg-muted text-muted-foreground")}>
                {preferences.comboEffects ? "ON" : "OFF"}
              </span>
            </button>

            <Link
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground"
            >
              <BarChart3 className="size-4" />
              <span>History</span>
            </Link>

            <Link
              to="/contributors"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground"
            >
              <Users className="size-4" />
              <span>Contributors</span>
            </Link>

            <Link
              to="/donate"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-amber-500/10 border-amber-500/30 text-amber-500"
            >
              <Heart className="size-4 fill-current" />
              <span>Donate</span>
            </Link>

            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border bg-card/70 border-border/40 text-foreground"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </Link>
          </div>
        )}
      </div>

      <SoundPackModal isOpen={showSoundModal} onClose={() => setShowSoundModal(false)} />
      <ThemeStudioModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </header>
  );
}
