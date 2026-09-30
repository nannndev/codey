import { describe as describeBadge, readStore } from "@/lib/achievements";
import { isUnlocked, sanitizeLook, WARDROBE, type KapColorId, type KapLook, type WardrobeItem, type WardrobeSlot } from "@/utils/kap-art";

export { isUnlocked, sanitizeLook, WARDROBE, type WardrobeItem, type WardrobeSlot };

/**
 * Kap's wardrobe: every item is unlocked by an achievement, so progress,
 * device sync and "you earned it" moments all come from the badge system.
 */

export const SLOT_NAMES: Record<WardrobeSlot, string> = { color: "Keycap", head: "Head", eyes: "Eyes", wear: "Wear" };

/** What it takes, from the badge's own goal text, e.g. "Hit 100 WPM on code". */
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
