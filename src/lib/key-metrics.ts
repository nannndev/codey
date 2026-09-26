import { FINGER_MAP, type KeyStat, type KeyboardStatsMap } from "@/utils/keyboard-analytics";
import { KEYBOARD_ROWS } from "@/lib/keyboard-layout";

/** How the analytics keyboard encodes each key. */
export type KeyMetric = "accuracy" | "speed" | "usage" | "fingers";

export interface KeyColumn {
  id: string;
  label: string;
  /** 0-1; the scene maps it to column height. */
  height: number;
  color: string;
  tracked: boolean;
}

export interface MetricLegend {
  title: string;
  low: string;
  high: string;
  /** CSS gradient for the legend bar (not shown for fingers). */
  gradient?: string;
}

type Stop = [number, [number, number, number]];

const hex = (rgb: [number, number, number]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Piecewise-linear color ramp over `stops` (value ascending). */
function ramp(stops: Stop[], value: number): string {
  if (value <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i += 1) {
    const [v1, c1] = stops[i];
    const [v0, c0] = stops[i - 1];
    if (value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return hex([c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]);
    }
  }
  return hex(stops[stops.length - 1][1]);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Accuracy: red at 80% and below, amber around 90%, green from 97%.
const ACCURACY_STOPS: Stop[] = [[80, [239, 68, 68]], [90, [245, 158, 11]], [97, [16, 185, 129]]];
// Latency: cyan when fast, amber mid, red when slow.
const SPEED_STOPS: Stop[] = [[80, [34, 211, 238]], [160, [245, 158, 11]], [260, [239, 68, 68]]];
// Usage: sequential indigo to bright cyan.
const USAGE_STOPS: Stop[] = [[0, [67, 56, 202]], [0.5, [59, 130, 246]], [1, [103, 232, 249]]];

export const LEGENDS: Record<KeyMetric, MetricLegend> = {
  accuracy: {
    title: "Taller = more errors",
    low: "97%+ accurate",
    high: "80% or less",
    gradient: "linear-gradient(90deg, #10b981, #f59e0b, #ef4444)",
  },
  speed: {
    title: "Taller = slower key",
    low: "≤80 ms",
    high: "≥260 ms",
    gradient: "linear-gradient(90deg, #22d3ee, #f59e0b, #ef4444)",
  },
  usage: {
    title: "Taller = pressed more often",
    low: "Rarely",
    high: "Most used",
    gradient: "linear-gradient(90deg, #4338ca, #3b82f6, #67e8f9)",
  },
  fingers: {
    title: "Color = finger, height = usage",
    low: "",
    high: "",
  },
};

const UNTRACKED_COLOR = "#2a2d38";

export function computeColumns(stats: KeyboardStatsMap, metric: KeyMetric): KeyColumn[] {
  const tracked = Object.values(stats).filter((stat) => stat.totalPresses > 0);
  // Space dwarfs every other key and sits in the front row, so it is left out
  // of the usage scale and capped; otherwise it hides the board behind it.
  const maxPresses = Math.max(1, ...tracked.filter((stat) => stat.key !== "SPACE").map((stat) => stat.totalPresses));

  return KEYBOARD_ROWS.flat().map((key) => {
    const stat = stats[key.id];
    const label = key.label || "Space";
    if (!stat || stat.totalPresses === 0) {
      return { id: key.id, label, height: 0, color: UNTRACKED_COLOR, tracked: false };
    }
    const usage = key.id === "SPACE" ? Math.min(0.12, stat.totalPresses / maxPresses) : Math.min(1, stat.totalPresses / maxPresses);
    switch (metric) {
      case "accuracy":
        return { id: key.id, label, tracked: true, height: clamp01((100 - stat.accuracy) / 20), color: ramp(ACCURACY_STOPS, stat.accuracy) };
      case "speed":
        return { id: key.id, label, tracked: true, height: clamp01((stat.avgDelayMs - 60) / 240), color: ramp(SPEED_STOPS, stat.avgDelayMs) };
      case "usage":
        return { id: key.id, label, tracked: true, height: Math.sqrt(usage), color: ramp(USAGE_STOPS, Math.sqrt(usage)) };
      case "fingers":
        return { id: key.id, label, tracked: true, height: Math.sqrt(usage), color: FINGER_MAP[key.id]?.color ?? "#64748b" };
    }
  });
}

export interface KeySummary {
  keystrokes: number;
  accuracy: number;
  latency: number;
  tracked: number;
}

export function summarize(stats: KeyboardStatsMap): KeySummary {
  const keys = Object.values(stats).filter((stat) => stat.totalPresses > 0);
  const presses = keys.reduce((sum, stat) => sum + stat.totalPresses, 0);
  const errors = keys.reduce((sum, stat) => sum + stat.errors, 0);
  const delay = keys.reduce((sum, stat) => sum + stat.totalDelayMs, 0);
  return {
    keystrokes: presses,
    accuracy: presses ? ((presses - errors) / presses) * 100 : 100,
    latency: presses ? Math.round(delay / presses) : 0,
    tracked: keys.length,
  };
}

export interface FingerSummary {
  name: string;
  color: string;
  presses: number;
  share: number;
  accuracy: number;
  latency: number;
}

/** Per-finger load, accuracy and latency; thumbs are merged into one row. */
export function fingerBreakdown(stats: KeyboardStatsMap): FingerSummary[] {
  const groups = new Map<string, { name: string; color: string; presses: number; errors: number; delay: number }>();
  for (const stat of Object.values(stats)) {
    const finger = FINGER_MAP[stat.key];
    if (!finger || stat.totalPresses === 0) continue;
    const name = finger.finger === "thumbs" ? "Thumbs" : finger.name;
    const group = groups.get(name) ?? { name, color: finger.color, presses: 0, errors: 0, delay: 0 };
    group.presses += stat.totalPresses;
    group.errors += stat.errors;
    group.delay += stat.totalDelayMs;
    groups.set(name, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.presses, 0) || 1;
  const order = ["Left Pinky", "Left Ring", "Left Middle", "Left Index", "Thumbs", "Right Index", "Right Middle", "Right Ring", "Right Pinky"];
  return [...groups.values()]
    .map((group) => ({
      name: group.name,
      color: group.color,
      presses: group.presses,
      share: group.presses / total,
      accuracy: group.presses ? ((group.presses - group.errors) / group.presses) * 100 : 100,
      latency: group.presses ? Math.round(group.delay / group.presses) : 0,
    }))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

/** Keys with enough presses to judge, ranked worst-first by `by`. */
export function rankKeys(stats: KeyboardStatsMap, by: "accuracy" | "speed", limit = 6, minPresses = 10): KeyStat[] {
  const eligible = Object.values(stats).filter((stat) => stat.totalPresses >= minPresses);
  return eligible
    .sort((a, b) => (by === "accuracy" ? a.accuracy - b.accuracy : b.avgDelayMs - a.avgDelayMs))
    .slice(0, limit);
}

/** The character a key types, for drills; null for keys drills cannot target. */
export function drillCharFor(keyId: string): string | null {
  if (/^[A-Z]$/.test(keyId)) return keyId.toLowerCase();
  if (keyId.length === 1) return keyId;
  return null;
}
