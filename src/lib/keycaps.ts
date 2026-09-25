/** Keycap colorways for the 3D keyboard. */

export type KeyRole = "alpha" | "mod" | "accent";

export interface KeyColors {
  cap: string;
  legend: string;
}

export interface KeycapColorway {
  id: string;
  name: string;
  alpha: KeyColors;
  mod: KeyColors;
  accent: KeyColors;
  /** Case/plate color. */
  plate: string;
  /** Glow for pressed and next-key hints; should contrast with the caps. */
  glow: string;
}

/** Per-key custom colors, keyed by physical key id. Either field may be unset. */
export type KeycapOverrides = Record<string, Partial<KeyColors>>;

/** "editor" follows the active editor theme instead of a fixed colorway. */
export const EDITOR_KEYCAPS = "editor";

export const KEYCAP_COLORWAYS: KeycapColorway[] = [
  {
    id: "carbon", name: "Carbon",
    alpha: { cap: "#2b2d31", legend: "#e6e6e6" },
    mod: { cap: "#1b1c1f", legend: "#f59e0b" },
    accent: { cap: "#f59e0b", legend: "#1b1c1f" },
    plate: "#111214", glow: "#f59e0b",
  },
  {
    id: "blush", name: "Blush",
    alpha: { cap: "#f3e3dc", legend: "#2b2b2b" },
    mod: { cap: "#2b2b2b", legend: "#e8b4a6" },
    accent: { cap: "#e8a797", legend: "#2b2b2b" },
    plate: "#1f1f1f", glow: "#f2a594",
  },
  {
    id: "retro", name: "Retro Beige",
    alpha: { cap: "#e8e2d0", legend: "#3a3a3a" },
    mod: { cap: "#b8b3a2", legend: "#3a3a3a" },
    accent: { cap: "#6fa287", legend: "#f4f1e6" },
    plate: "#cfc8b4", glow: "#6fa287",
  },
  {
    id: "botanical", name: "Botanical",
    alpha: { cap: "#e9efe6", legend: "#3d5a45" },
    mod: { cap: "#6f8f72", legend: "#f0f4ec" },
    accent: { cap: "#c9a86a", legend: "#2f3b2f" },
    plate: "#2f3b30", glow: "#8fd19e",
  },
  {
    id: "laser", name: "Laser",
    alpha: { cap: "#2a1e5c", legend: "#ff5ecb" },
    mod: { cap: "#1a1240", legend: "#47e5ff" },
    accent: { cap: "#ff2e97", legend: "#ffffff" },
    plate: "#0f0a26", glow: "#47e5ff",
  },
  {
    id: "arctic", name: "Arctic",
    alpha: { cap: "#f7f9fc", legend: "#5b6b82" },
    mod: { cap: "#c9d6e8", legend: "#34445c" },
    accent: { cap: "#5aa9e6", legend: "#ffffff" },
    plate: "#dfe7f2", glow: "#3b8fd9",
  },
  {
    id: "matcha", name: "Matcha",
    alpha: { cap: "#f4f1e1", legend: "#556b2f" },
    mod: { cap: "#8a9a5b", legend: "#f4f1e1" },
    accent: { cap: "#d97757", legend: "#ffffff" },
    plate: "#3f4a2a", glow: "#d97757",
  },
];

const MOD_KEYS = new Set([
  "TAB", "CAPS", "SHIFT_L", "SHIFT_R", "CTRL_L", "CTRL_R", "ALT_L", "ALT_R", "META_L", "META_R", "BACKSPACE",
]);

export function keyRole(id: string): KeyRole {
  if (id === "ENTER") return "accent";
  return MOD_KEYS.has(id) ? "mod" : "alpha";
}

export function getColorway(id: string): KeycapColorway | null {
  return KEYCAP_COLORWAYS.find((colorway) => colorway.id === id) ?? null;
}

/**
 * Resolved colors for one key: an override wins over the colorway. Returns
 * null fields where the editor theme's CSS defaults should apply.
 */
export function resolveKeyColors(
  id: string,
  colorway: KeycapColorway | null,
  overrides: KeycapOverrides,
): Partial<KeyColors> {
  const base = colorway ? colorway[keyRole(id)] : {};
  return { ...base, ...overrides[id] };
}
