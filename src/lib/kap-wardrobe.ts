import { describe as describeBadge, readStore } from "@/lib/achievements";
import { KAP_COLORS, type KapColorId, type KapEyesId, type KapHeadId, type KapLook, type KapWearId } from "@/components/streak/kap-skins";

/**
 * Kap's wardrobe: every item is unlocked by an achievement, so progress,
 * device sync and "you earned it" moments all come from the badge system.
 */

export type WardrobeSlot = "color" | "head" | "eyes" | "wear";

export interface WardrobeItem {
  slot: WardrobeSlot;
  id: KapColorId | KapHeadId | KapEyesId | KapWearId;
  name: string;
  /** Achievement id that unlocks it; null is free. */
  requires: string | null;
}

const COLOR_UNLOCKS: Record<KapColorId, string | null> = {
  amber: null,
  retro: "runs-1",
  ocean: "streak-2",
  sakura: "streak-3",
  matcha: "runs-2",
  graphite: "ranked-2",
  obsidian: "time-3",
};

export const WARDROBE: WardrobeItem[] = [
  ...KAP_COLORS.map((color) => ({ slot: "color" as const, id: color.id, name: color.name, requires: COLOR_UNLOCKS[color.id] })),
  { slot: "head", id: "headphones", name: "Headphones", requires: "time-2" },
  { slot: "head", id: "party", name: "Party hat", requires: "duel-1" },
  { slot: "head", id: "halo", name: "Halo", requires: "flawless" },
  { slot: "eyes", id: "shades", name: "Pixel shades", requires: "speed-3" },
  { slot: "eyes", id: "nerd", name: "Nerd glasses", requires: "polyglot-3" },
  { slot: "eyes", id: "monocle", name: "Monocle", requires: "daily-2" },
  { slot: "wear", id: "scarf", name: "Scarf", requires: "streak-1" },
  { slot: "wear", id: "headband", name: "Headband", requires: "streak-4" },
  { slot: "wear", id: "cape", name: "Cape", requires: "speed-4" },
];

export const SLOT_NAMES: Record<WardrobeSlot, string> = { color: "Keycap", head: "Head", eyes: "Eyes", wear: "Wear" };

export const isUnlocked = (item: WardrobeItem, earned: ReadonlySet<string>) => item.requires === null || earned.has(item.requires);

/** What it takes, from the badge's own goal text, e.g. "Hit 100 WPM in a run". */
export function unlockHint(item: WardrobeItem): string {
  if (!item.requires) return "Free";
  return describeBadge(item.requires)?.goal ?? "Keep practicing";
}

export function earnedBadges(): Set<string> {
  return new Set(Object.keys(readStore().unlockedAt));
}

/** Items a newly earned badge unlocks, for the achievement toast. */
export function itemsUnlockedBy(badgeId: string): WardrobeItem[] {
  return WARDROBE.filter((item) => item.requires === badgeId);
}

/* ---- The chosen look ---- */

export const LOOK_KEY = "codey_kap_look";
export const LOOK_EVENT = "codey:kap-look";

const SLOTS: WardrobeSlot[] = ["color", "head", "eyes", "wear"];

/** Keeps only known items that are unlocked, so a stale or synced look never shows locked gear. */
export function sanitizeLook(value: unknown, earned: ReadonlySet<string>): KapLook {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const look: KapLook = {};
  for (const slot of SLOTS) {
    const item = WARDROBE.find((candidate) => candidate.slot === slot && candidate.id === raw[slot]);
    if (item && isUnlocked(item, earned)) (look as Record<string, string>)[slot] = item.id;
  }
  return look;
}

export function readLook(earned: ReadonlySet<string> = earnedBadges()): KapLook {
  try {
    return sanitizeLook(JSON.parse(localStorage.getItem(LOOK_KEY) ?? "null"), earned);
  } catch {
    return {};
  }
}

export function writeLook(look: KapLook) {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    // Kept for this tab only.
  }
  window.dispatchEvent(new CustomEvent(LOOK_EVENT));
}

/** Puts an item on, or takes it off when it is already worn (colour always stays on). */
export function toggleItem(look: KapLook, item: WardrobeItem): KapLook {
  const current = (look as Record<string, string | null | undefined>)[item.slot];
  if (item.slot === "color") return { ...look, color: item.id as KapColorId };
  return { ...look, [item.slot]: current === item.id ? null : item.id };
}
