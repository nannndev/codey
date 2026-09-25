import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Check,
  CornerDownLeft,
  Flame,
  Gamepad2,
  Headphones,
  Heart,
  Home,
  IndentIncrease,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  Search,
  Settings,
  Sun,
  Swords,
  Trophy,
  UserRound,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { usePreferences } from "./PreferencesProvider";
import { useFlowRadio } from "./RadioProvider";
import { useTheme } from "./ThemeProvider";
import { THEMES } from "./ThemeStudioModal";
import { openKeycapStudio } from "./KeycapStudioModal";
import { EDITOR_KEYCAPS, KEYCAP_COLORWAYS } from "@/lib/keycaps";
import { cn } from "@/lib/utils";

/** Dispatch on window to open the palette from anywhere (e.g. a header button). */
export const OPEN_COMMAND_PALETTE_EVENT = "codey:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

interface Command {
  id: string;
  group: "Go to" | "Appearance" | "Toggles";
  label: string;
  keywords?: string;
  icon: LucideIcon;
  /** Checkmark for the current theme, ON/OFF for switches. */
  state?: "active" | "on" | "off";
  run: () => void;
}

/**
 * Ranks a command against the query in tiers: a substring of the label beats a
 * fuzzy (in-order subsequence) label match, which beats keyword prefixes.
 * Fuzzy matching is kept to the label because across long keyword lists
 * almost any short query matches something.
 */
function score(command: Command, query: string): number {
  const q = query.toLowerCase();
  const label = command.label.toLowerCase();

  const substringAt = label.indexOf(q);
  if (substringAt !== -1) {
    const atWordStart = substringAt === 0 || label[substringAt - 1] === " ";
    return 300 + (atWordStart ? 50 : 0) - substringAt;
  }

  let fuzzy = 0;
  let from = 0;
  let prev = -2;
  for (const char of q.replace(/\s+/g, "")) {
    const index = label.indexOf(char, from);
    if (index === -1) { fuzzy = 0; break; }
    fuzzy += 1 + (index === prev + 1 ? 2 : 0) + (index === 0 || label[index - 1] === " " ? 3 : 0);
    prev = index;
    from = index + 1;
  }
  if (fuzzy > 0) return 100 + fuzzy;

  const words = `${label} ${command.keywords ?? ""}`.toLowerCase().split(/[\s:-]+/);
  const tokens = q.split(/\s+/).filter(Boolean);
  const keywordHit = tokens.length > 0 && tokens.every((token) => words.some((word) => word.startsWith(token)));
  return keywordHit ? 50 : 0;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const navigate = useNavigate();
  const { preferences, setPreference } = usePreferences();
  const { theme, setTheme } = useTheme();
  const radio = useFlowRadio();

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Hand focus back so the typing area keeps receiving keys.
    requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path);
    const toggle = (key: "keyboardSound" | "comboEffects" | "ghostRunner" | "autoIndent" | "keyboard3d") => () =>
      setPreference(key, !preferences[key]);
    const onOff = (value: boolean): Command["state"] => (value ? "on" : "off");

    return [
      { id: "go-home", group: "Go to", label: "Practice", keywords: "home type test start", icon: Home, run: go("/") },
      { id: "go-duel", group: "Go to", label: "Duel", keywords: "race multiplayer versus", icon: Swords, run: go("/duel") },
      { id: "go-arcade", group: "Go to", label: "Arcade", keywords: "game falling notes", icon: Gamepad2, run: go("/arcade") },
      { id: "go-leaderboard", group: "Go to", label: "Leaderboard", keywords: "ranked ranking top", icon: Trophy, run: go("/leaderboard") },
      { id: "go-analytics", group: "Go to", label: "Keyboard Analytics", keywords: "heatmap keys weak", icon: Keyboard, run: go("/analytics/keyboard") },
      { id: "go-history", group: "Go to", label: "History", keywords: "stats statistics runs", icon: BarChart3, run: go("/history") },
      { id: "go-profile", group: "Go to", label: "Profile", keywords: "account me", icon: UserRound, run: go("/profile") },
      { id: "go-settings", group: "Go to", label: "Settings", keywords: "preferences font cursor", icon: Settings, run: go("/settings") },
      { id: "go-contributors", group: "Go to", label: "Contributors", keywords: "credits", icon: Users, run: go("/contributors") },
      { id: "go-donate", group: "Go to", label: "Support Codey", keywords: "donate sponsor", icon: Heart, run: go("/donate") },

      { id: "mode-light", group: "Appearance", label: "Light mode", keywords: "theme color scheme", icon: Sun, state: theme === "light" ? "active" : undefined, run: () => setTheme("light") },
      { id: "mode-dark", group: "Appearance", label: "Dark mode", keywords: "theme color scheme", icon: Moon, state: theme === "dark" ? "active" : undefined, run: () => setTheme("dark") },
      { id: "mode-system", group: "Appearance", label: "System mode", keywords: "theme color scheme auto", icon: Monitor, state: theme === "system" ? "active" : undefined, run: () => setTheme("system") },
      ...THEMES.map((option): Command => ({
        id: `theme-${option.id}`,
        group: "Appearance",
        label: `Editor theme: ${option.name}`,
        keywords: "syntax colors",
        icon: Palette,
        state: preferences.editorTheme === option.id ? "active" : undefined,
        run: () => setPreference("editorTheme", option.id),
      })),
      { id: "keycap-studio", group: "Appearance", label: "Keycap Studio", keywords: "customize paint keyboard 3d colors", icon: Keyboard, run: openKeycapStudio },
      { id: "keycaps-editor", group: "Appearance", label: "Keycaps: Editor theme", keywords: "colorway keyboard", icon: Keyboard, state: preferences.keycapTheme === EDITOR_KEYCAPS ? "active" : undefined, run: () => setPreference("keycapTheme", EDITOR_KEYCAPS) },
      ...KEYCAP_COLORWAYS.map((option): Command => ({
        id: `keycaps-${option.id}`,
        group: "Appearance",
        label: `Keycaps: ${option.name}`,
        keywords: "colorway keyboard",
        icon: Keyboard,
        state: preferences.keycapTheme === option.id ? "active" : undefined,
        run: () => setPreference("keycapTheme", option.id),
      })),

      { id: "toggle-sound", group: "Toggles", label: "Keyboard sound", keywords: "audio click switch mute", icon: Volume2, state: onOff(preferences.keyboardSound), run: toggle("keyboardSound") },
      { id: "toggle-combo", group: "Toggles", label: "Combo sparks", keywords: "effects glow streak", icon: Flame, state: onOff(preferences.comboEffects), run: toggle("comboEffects") },
      { id: "strike-full", group: "Appearance", label: "Strike effects: Full", keywords: "shake impact particles typing", icon: Flame, state: preferences.strikeIntensity === "full" ? "active" : undefined, run: () => setPreference("strikeIntensity", "full") },
      { id: "strike-subtle", group: "Appearance", label: "Strike effects: Subtle", keywords: "calm no shake particles typing", icon: Flame, state: preferences.strikeIntensity === "subtle" ? "active" : undefined, run: () => setPreference("strikeIntensity", "subtle") },
      { id: "toggle-ghost", group: "Toggles", label: "Ghost runner", keywords: "personal best pb pace", icon: Flame, state: onOff(preferences.ghostRunner), run: toggle("ghostRunner") },
      { id: "toggle-indent", group: "Toggles", label: "Auto-indent", keywords: "whitespace tab enter", icon: IndentIncrease, state: onOff(preferences.autoIndent), run: toggle("autoIndent") },
      { id: "toggle-keyboard3d", group: "Toggles", label: "3D keyboard", keywords: "keycaps visual hint", icon: Keyboard, state: onOff(preferences.keyboard3d), run: toggle("keyboard3d") },
      { id: "toggle-radio", group: "Toggles", label: "Flow radio", keywords: "music lofi play pause", icon: Headphones, state: onOff(radio.isPlaying), run: radio.togglePlay },
    ];
  }, [navigate, preferences, setPreference, theme, setTheme, radio.isPlaying, radio.togglePlay]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;
    return commands
      .map((command) => ({ command, score: score(command, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const runCommand = (command: Command) => {
    // Toggles keep the palette open so several can be flipped in a row.
    if (command.group === "Toggles") {
      command.run();
      return;
    }
    close();
    command.run();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) runCommand(command);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const activeId = results[activeIndex] ? `command-${results[activeIndex].id}` : undefined;
  // Group headings only make sense in the unfiltered list; search results are ranked.
  const showGroups = !query.trim();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 border-b border-border/70 px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, themes, settings…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">Esc</kbd>
        </div>

        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching commands</p>
          )}
          {results.map((command, index) => {
            const Icon = command.icon;
            const isActive = index === activeIndex;
            const heading = showGroups && (index === 0 || results[index - 1].group !== command.group) ? command.group : null;
            return (
              <div key={command.id}>
                {heading && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">{heading}</p>
                )}
                <div
                  id={`command-${command.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => { if (!isActive) setActiveIndex(index); }}
                  onClick={() => runCommand(command)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-foreground/80",
                  )}
                >
                  <Icon aria-hidden="true" className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.state === "active" && <Check aria-label="current" className="size-4 shrink-0 text-primary" />}
                  {(command.state === "on" || command.state === "off") && (
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                        command.state === "on" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {command.state === "on" ? "ON" : "OFF"}
                    </span>
                  )}
                  {isActive && !command.state && <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-border/70 px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span><kbd className="font-semibold text-foreground/80">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold text-foreground/80">↵</kbd> run</span>
          <span className="ml-auto"><kbd className="font-semibold text-foreground/80">{isMac() ? "⌘" : "Ctrl"} K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

export function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}
