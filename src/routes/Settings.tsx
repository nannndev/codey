import { ArrowLeft, Command, Flame, Maximize2, Play, RotateCcw, Volume2, VolumeX, Type, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  usePreferences,
  DEFAULT_SOUND_TUNING,
  type AppShortcut,
  type FontSize,
  type FontFamily,
  type CursorStyle,
  type EditorTheme,
  type KeyboardSoundProfile,
  type KeyboardSoundTuning,
  type SoundBaseProfile,
} from "@/components/PreferencesProvider";
import { Footer } from "@/components/Footer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getSettings, saveSettings } from "@/utils/storage";
import { useAuth } from "@/components/AuthProvider";
import { saveCloudGoals } from "@/lib/cloud";
import { useKeyboardSound } from "@/hooks";
import { cn } from "@/lib/utils";

function SettingSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onCheckedChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500",
        checked ? "bg-amber-500 shadow-xs" : "bg-muted border-border/80"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block size-5 transform rounded-full bg-white dark:bg-zinc-950 shadow-md ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  ...(["12", "14", "16", "18", "20", "22", "24"] as FontSize[]).map((value) => ({ value, label: `${value}px` })),
];

const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "jetbrains", label: "JetBrains Mono" },
  { value: "fira", label: "Fira Code" },
  { value: "cascadia", label: "Cascadia Code" },
  { value: "source", label: "Source Code Pro" },
];

const CURSOR_OPTIONS: { value: CursorStyle; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "line", label: "Line" },
];

const EDITOR_THEMES: { value: EditorTheme; label: string; color: string }[] = [
  { value: "codey", label: "Codey Mono", color: "#f59e0b" },
  { value: "tokyo", label: "Tokyo Night", color: "#38bdf8" },
  { value: "catppuccin", label: "Catppuccin", color: "#c084fc" },
  { value: "github", label: "GitHub Light", color: "#10b981" },
  { value: "dracula", label: "Dracula", color: "#ec4899" },
];

const SHORTCUT_OPTIONS: Array<{ value: AppShortcut; label: string }> = [
  { value: "mod+r", label: "⌘/Ctrl + R" },
  { value: "mod+shift+r", label: "⌘/Ctrl + Shift + R" },
  { value: "mod+f", label: "⌘/Ctrl + F" },
  { value: "mod+shift+f", label: "⌘/Ctrl + Shift + F" },
  { value: "mod+enter", label: "⌘/Ctrl + Enter" },
];

const SOUND_PROFILES: Array<{ value: KeyboardSoundProfile; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "tactile", label: "Tactile" },
  { value: "clicky", label: "Clicky" },
  { value: "thock", label: "Thock" },
  { value: "custom", label: "Custom" },
];

const SOUND_BASES: Array<{ value: SoundBaseProfile; label: string }> = SOUND_PROFILES
  .filter((profile): profile is typeof profile & { value: SoundBaseProfile } => profile.value !== "custom")
  .map(({ value, label }) => ({ value, label }));

const SOUND_KNOBS: Array<{ key: keyof Omit<KeyboardSoundTuning, "base">; label: string; low: string; high: string }> = [
  { key: "tone", label: "Tone", low: "deep", high: "bright" },
  { key: "click", label: "Click", low: "none", high: "sharp" },
  { key: "damping", label: "Damping", low: "tight", high: "ringy" },
  { key: "upstroke", label: "Upstroke", low: "none", high: "loud" },
];

export default function Settings() {
  const { preferences, setPreference } = usePreferences();
  const { user } = useAuth();
  const [settings, setSettings] = useState(getSettings);
  const previewSound = useKeyboardSound(
    true,
    preferences.keyboardSoundProfile,
    preferences.keyboardSoundVolume,
    preferences.keyboardSoundTuning
  );

  const previewTimers = useRef<number[]>([]);

  useEffect(() => () => {
    previewTimers.current.forEach(window.clearTimeout);
  }, []);

  const playPreview = () => {
    previewTimers.current.forEach(window.clearTimeout);
    previewTimers.current = [];
    const keys = ["c", "o", "d", "e", "y", " ", "f", "a", "s", "t", "Enter"];
    const gaps = [0, 88, 71, 96, 64, 132, 78, 61, 84, 69, 150];
    let at = 0;
    keys.forEach((key, index) => {
      at += gaps[index];
      previewTimers.current.push(window.setTimeout(() => previewSound(key, true), at));
    });
  };

  const tuning = preferences.keyboardSoundTuning;
  const isCustom = preferences.keyboardSoundProfile === "custom";
  const isTuned = SOUND_KNOBS.some((k) => tuning[k.key] !== DEFAULT_SOUND_TUNING[k.key]);

  const updateTuning = <K extends keyof KeyboardSoundTuning>(key: K, value: KeyboardSoundTuning[K]) => {
    setPreference("keyboardSoundTuning", { ...tuning, [key]: value });
  };

  const selectProfile = (value: KeyboardSoundProfile) => {
    setPreference("keyboardSoundProfile", value);
    previewSound("d", true);
  };

  const updateGoal = (key: keyof typeof settings.goals, rawValue: string) => {
    const value = Math.max(1, Math.round(Number(rawValue) || 1));
    const next = { ...settings, goals: { ...settings.goals, [key]: value } };
    setSettings(next);
    saveSettings(next);
    if (user) void saveCloudGoals(next.goals).catch((error) => console.error("Unable to sync daily goals", error));
  };

  const updateShortcut = (key: "restartShortcut" | "focusShortcut", value: AppShortcut) => {
    const otherKey = key === "restartShortcut" ? "focusShortcut" : "restartShortcut";
    if (preferences[otherKey] === value) setPreference(otherKey, preferences[key]);
    setPreference(key, value);
  };

  return (
    <div className="workspace-shell min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Navigation & Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-all hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Editor
          </Link>
          <div className="text-right">
            <h1 className="text-lg font-bold tracking-tight text-foreground font-sans">Settings</h1>
            <p className="text-[11px] text-muted-foreground font-sans">Customize your typing experience</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 animate-fade-in-up">
          {/* Section 1: Tactile Feedback & Visual Effects */}
          <div className="glass-card rounded-2xl p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                Feedback & Visual Effects
              </h2>
            </div>

            <div className="divide-y divide-border/40">
              {/* Combo Streaks & Sparks */}
              <div className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Flame className="mt-0.5 size-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Combo Streaks & Cursor Sparks</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Spark particles at cursor, dynamic window cyber glow, and milestone chime notes.
                    </p>
                  </div>
                </div>
                <SettingSwitch
                  checked={preferences.comboEffects}
                  onCheckedChange={() => setPreference("comboEffects", !preferences.comboEffects)}
                  label="Toggle combo effects"
                />
              </div>

              {/* Ghost Runner */}
              <div className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 text-sm shrink-0">👻</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Ghost Runner (PB Race)</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Show ghost caret & real-time WPM pace relative to your Personal Best.
                    </p>
                  </div>
                </div>
                <SettingSwitch
                  checked={preferences.ghostRunner}
                  onCheckedChange={() => setPreference("ghostRunner", !preferences.ghostRunner)}
                  label="Toggle ghost runner"
                />
              </div>

              {/* Mechanical Keyboard Sound */}
              <div className="pt-3">
                <div className="flex items-center justify-between gap-4 mb-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {preferences.keyboardSound ? (
                      <Volume2 className="mt-0.5 size-4 text-amber-500 shrink-0" />
                    ) : (
                      <VolumeX className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-foreground">Mechanical Sound Engine</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Realistic switch click synthesis with pitch variance.
                      </p>
                    </div>
                  </div>
                  <SettingSwitch
                    checked={preferences.keyboardSound}
                    onCheckedChange={() => setPreference("keyboardSound", !preferences.keyboardSound)}
                    label="Toggle keyboard sound"
                  />
                </div>

                {preferences.keyboardSound && (
                  <div className="mt-3 space-y-3 rounded-xl bg-background/50 border border-border/50 p-3 animate-fade-in-up">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">Switch Profile</span>
                      <div className="flex flex-wrap gap-1">
                        {SOUND_PROFILES.map((sound) => (
                          <button
                            key={sound.value}
                            type="button"
                            onClick={() => selectProfile(sound.value)}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-all cursor-pointer",
                              preferences.keyboardSoundProfile === sound.value
                                ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                                : "border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            {sound.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isCustom && (
                      <div className="space-y-2.5 border-t border-border/40 pt-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Custom Base</span>
                          <div className="flex items-center gap-2">
                            <select
                              id="sound-base"
                              value={tuning.base}
                              onChange={(event) => updateTuning("base", event.target.value as SoundBaseProfile)}
                              className="h-7 rounded-md border bg-card px-2 text-xs font-medium"
                            >
                              {SOUND_BASES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setPreference("keyboardSoundTuning", { ...DEFAULT_SOUND_TUNING, base: tuning.base })}
                              disabled={!isTuned}
                              className="rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {SOUND_KNOBS.map((control) => (
                            <label key={control.key} className="block rounded-lg border bg-card/40 p-2">
                              <span className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="font-semibold text-foreground">{control.label}</span>
                                <span className="font-mono tabular-nums">{tuning[control.key]}</span>
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={tuning[control.key]}
                                onChange={(event) => updateTuning(control.key, Number(event.target.value))}
                                onMouseUp={() => previewSound("d", true)}
                                onKeyUp={() => previewSound("d", true)}
                                className="h-1.5 w-full cursor-pointer accent-amber-500"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 border-t border-border/40 pt-2.5">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">Volume</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={preferences.keyboardSoundVolume}
                          onChange={(event) => setPreference("keyboardSoundVolume", Number(event.target.value))}
                          className="h-1.5 w-full cursor-pointer accent-amber-500"
                        />
                        <span className="font-mono text-xs font-bold tabular-nums text-foreground w-8 text-right">
                          {preferences.keyboardSoundVolume}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={playPreview}
                        className="flex h-7 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                      >
                        <Play className="size-3 text-amber-500" />
                        Preview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Editor & Typography */}
          <div className="glass-card rounded-2xl p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Type className="size-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                Editor & Typography
              </h2>
            </div>

            <div className="space-y-3.5">
              {/* Themes */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Editor Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {EDITOR_THEMES.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => setPreference("editorTheme", theme.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer",
                        preferences.editorTheme === theme.value
                          ? "border-amber-500 bg-amber-500/10 shadow-xs"
                          : "border-border/60 hover:border-foreground/30 bg-card/40"
                      )}
                    >
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.color }} />
                      <span className="text-xs font-semibold truncate text-foreground">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family & Size & Cursor in a 3-column row */}
              <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border/40">
                {/* Font Family */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Font Family</label>
                  <select
                    value={preferences.fontFamily}
                    onChange={(event) => setPreference("fontFamily", event.target.value as FontFamily)}
                    className="h-9 w-full rounded-xl border border-border/70 bg-card px-2.5 text-xs font-mono font-medium text-foreground cursor-pointer"
                  >
                    {FONT_FAMILY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Font Size</label>
                  <ToggleGroup
                    type="single"
                    value={preferences.fontSize}
                    onValueChange={(v) => v && setPreference("fontSize", v as FontSize)}
                    className="justify-between gap-1 w-full"
                  >
                    {FONT_SIZE_OPTIONS.slice(1, 6).map((opt) => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value}
                        className="h-9 flex-1 rounded-lg px-1 text-xs font-mono transition-all data-[state=on]:bg-amber-500 data-[state=on]:text-zinc-950 data-[state=on]:font-bold"
                      >
                        {opt.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                {/* Cursor Style */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Cursor Style</label>
                  <ToggleGroup
                    type="single"
                    value={preferences.cursorStyle}
                    onValueChange={(v) => v && setPreference("cursorStyle", v as CursorStyle)}
                    className="justify-between gap-1 w-full"
                  >
                    {CURSOR_OPTIONS.map((opt) => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value}
                        className="h-9 flex-1 rounded-lg px-2 text-xs font-sans capitalize transition-all data-[state=on]:bg-amber-500 data-[state=on]:text-zinc-950 data-[state=on]:font-bold"
                      >
                        {opt.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Keyboard Shortcuts & Daily Goals in 2 cols */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Keyboard Shortcuts */}
            <div className="glass-card rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <Command className="size-4 text-amber-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                    Shortcuts
                  </h2>
                </div>
                <div className="space-y-2">
                  {([
                    ["restartShortcut", "Restart run", RotateCcw],
                    ["focusShortcut", "Focus Mode", Maximize2],
                  ] as const).map(([key, label, Icon]) => (
                    <label key={key} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {label}
                      </span>
                      <select
                        value={preferences[key]}
                        onChange={(event) => updateShortcut(key, event.target.value as AppShortcut)}
                        className="h-7 rounded-lg border border-border/70 bg-card px-2 text-[11px] font-mono font-medium text-foreground cursor-pointer"
                      >
                        {SHORTCUT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1 text-[10px] text-muted-foreground font-mono">
                <span className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5">Esc: restart</span>
                <span className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5">Tab: indent / stop</span>
                <span className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5">Enter: retry</span>
              </div>
            </div>

            {/* Daily Goals */}
            <div className="glass-card rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-amber-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                      Daily Goals
                    </h2>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {user ? "Cloud Synced" : "Local"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["runsPerDay", "Runs", settings.goals.runsPerDay],
                    ["minutesPerDay", "Minutes", settings.goals.minutesPerDay],
                    ["charsPerDay", "Chars", settings.goals.charsPerDay],
                  ] as const).map(([key, label, value]) => (
                    <label key={key} className="rounded-xl border border-border/60 bg-card/40 p-2 text-center block">
                      <span className="text-[10px] font-semibold text-muted-foreground block mb-1">{label}</span>
                      <input
                        type="number"
                        min="1"
                        value={value}
                        onChange={(event) => updateGoal(key, event.target.value)}
                        className="h-8 w-full rounded-lg border border-border/70 bg-background text-center font-mono text-xs font-bold text-foreground"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-[10px] text-muted-foreground text-center">
                Progress resets automatically at midnight.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
