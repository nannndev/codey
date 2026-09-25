import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type FontSize = "12" | "14" | "16" | "18" | "20" | "22" | "24";
export type FontFamily = "jetbrains" | "fira" | "cascadia" | "source";
export type CursorStyle = "block" | "underline" | "line";
export type SnippetLength = "short" | "medium" | "long";
export type EditorTheme = "codey" | "tokyo" | "catppuccin" | "one-dark" | "dracula" | "nord" | "synthwave" | "github" | "gruvbox" | "cyberpunk";
export type AppShortcut = "mod+r" | "mod+shift+r" | "mod+f" | "mod+shift+f" | "mod+enter";
export type KeyboardSoundProfile = "linear" | "tactile" | "clicky" | "thock" | "custom";
export type SoundBaseProfile = Exclude<KeyboardSoundProfile, "custom">;

/**
 * Macro controls for the "custom" profile. Each value is 0-100 with 50 meaning
 * "leave the base preset alone", so every position maps to a usable keyboard
 * rather than exposing raw synth parameters that mostly sound broken.
 */
export interface KeyboardSoundTuning {
  base: SoundBaseProfile;
  tone: number;
  click: number;
  damping: number;
  upstroke: number;
}

export interface Preferences {
  fontSize: FontSize;
  fontFamily: FontFamily;
  cursorStyle: CursorStyle;
  snippetLength: SnippetLength;
  editorTheme: EditorTheme;
  keyboardSound: boolean;
  keyboardSoundProfile: KeyboardSoundProfile;
  keyboardSoundVolume: number;
  keyboardSoundTuning: KeyboardSoundTuning;
  restartShortcut: AppShortcut;
  focusShortcut: AppShortcut;
  ghostRunner: boolean;
  comboEffects: boolean;
  autoIndent: boolean;
  keyboard3d: boolean;
}

export const DEFAULT_SOUND_TUNING: KeyboardSoundTuning = {
  base: "thock",
  tone: 50,
  click: 50,
  damping: 50,
  upstroke: 50,
};

interface PreferencesContextValue {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// Keep the pre-rename key so existing Codey preferences survive the rename.
const STORAGE_KEY = "codetype-preferences";

const DEFAULTS: Preferences = {
  fontSize: "16",
  fontFamily: "jetbrains",
  cursorStyle: "block",
  snippetLength: "medium",
  editorTheme: "codey",
  keyboardSound: false,
  keyboardSoundProfile: "thock",
  keyboardSoundVolume: 45,
  keyboardSoundTuning: DEFAULT_SOUND_TUNING,
  restartShortcut: "mod+r",
  focusShortcut: "mod+shift+f",
  ghostRunner: true,
  comboEffects: true,
  autoIndent: true,
  keyboard3d: true,
};

const FONT_SIZE_MAP: Record<FontSize, string> = {
  "12": "12px",
  "14": "14px",
  "16": "16px",
  "18": "18px",
  "20": "20px",
  "22": "22px",
  "24": "24px",
};

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  jetbrains: '"JetBrains Mono", monospace',
  fira: '"Fira Code", monospace',
  cascadia: '"Cascadia Code", monospace',
  source: '"Source Code Pro", monospace',
};

function applyPreferences(prefs: Preferences) {
  document.documentElement.style.setProperty("--code-font-size", FONT_SIZE_MAP[prefs.fontSize]);
  document.documentElement.style.setProperty("--code-font-family", FONT_FAMILY_MAP[prefs.fontFamily]);
  document.documentElement.style.setProperty("--code-cursor-style", prefs.cursorStyle);
  document.documentElement.dataset.editorTheme = prefs.editorTheme;
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const migratedFontSize = parsed.fontSize === "sm" ? "12" : parsed.fontSize === "md" ? "14" : parsed.fontSize === "lg" ? "16" : parsed.fontSize;
      return {
        ...DEFAULTS,
        ...parsed,
        fontSize: migratedFontSize ?? DEFAULTS.fontSize,
        // Nested object, so a shallow spread would let a partial or absent
        // tuning through and leave individual knobs undefined.
        keyboardSoundTuning: { ...DEFAULT_SOUND_TUNING, ...(parsed.keyboardSoundTuning ?? {}) },
      };
    }
  } catch {
    // fall through
  }
  return DEFAULTS;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
