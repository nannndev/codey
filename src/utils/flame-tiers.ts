/** Kap's flame by streak length. Shared by the app and the share-card server, so no path aliases. */

export interface FlameTier {
  id: "spark" | "flame" | "blaze" | "blue" | "legend";
  name: string;
  /** Days needed to reach this flame. */
  min: number;
  /** Flame height relative to the "blaze" flame. */
  scale: number;
  flame: string;
  core: string;
  /** Keycap colours when lit: top face, front skirt, sides and arms. */
  cap: [string, string, string];
  crown?: boolean;
}

export const FLAME_TIERS: FlameTier[] = [
  { id: "spark", name: "Spark", min: 1, scale: 0.6, flame: "#f97316", core: "#fed7aa", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "flame", name: "Flame", min: 3, scale: 0.8, flame: "#f59e0b", core: "#fef3c7", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "blaze", name: "Blaze", min: 7, scale: 1, flame: "#f59e0b", core: "#fef3c7", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "blue", name: "Blue fire", min: 30, scale: 1.08, flame: "#3b82f6", core: "#dbeafe", cap: ["#e0f2fe", "#7dd3fc", "#0284c7"] },
  { id: "legend", name: "Legend", min: 100, scale: 1.2, flame: "#a855f7", core: "#f3e8ff", cap: ["#ede9fe", "#c4b5fd", "#8b5cf6"], crown: true },
];

export function tierFor(days: number): FlameTier | null {
  let tier: FlameTier | null = null;
  for (const candidate of FLAME_TIERS) if (days >= candidate.min) tier = candidate;
  return tier;
}
