/** Whether Kap keeps you company in the corner of the practice screen. */

export const BUDDY_KEY = "codey_kap_buddy";
export const BUDDY_EVENT = "codey:kap-buddy";

/** On by default where there is room beside the editor (wide screens). */
export function readBuddy(): boolean {
  try {
    const saved = localStorage.getItem(BUDDY_KEY);
    if (saved === "on") return true;
    if (saved === "off") return false;
  } catch {
    // Fall through to the default.
  }
  return typeof window !== "undefined" && window.matchMedia?.("(min-width: 1280px)").matches === true;
}

export function writeBuddy(on: boolean) {
  try {
    localStorage.setItem(BUDDY_KEY, on ? "on" : "off");
  } catch {
    // This tab only.
  }
  window.dispatchEvent(new CustomEvent(BUDDY_EVENT));
}

/* ---- Where he stands: dragged anywhere, kept on screen ---- */

export const BUDDY_POS_KEY = "codey_kap_buddy_pos";
const MARGIN = 8;

/** Top-left corner as fractions of the viewport, so it survives a resize. */
export interface BuddyPos {
  x: number;
  y: number;
}

/** Pixel position of the box, clamped so the whole of Kap stays visible. */
export function placeBuddy(pos: BuddyPos | null, box: { width: number; height: number }, view: { width: number; height: number }) {
  const maxX = Math.max(MARGIN, view.width - box.width - MARGIN);
  const maxY = Math.max(MARGIN, view.height - box.height - MARGIN);
  // Default: bottom-left, beside the editor.
  const left = pos ? pos.x * view.width : 12;
  const top = pos ? pos.y * view.height : view.height - box.height - 12;
  return { left: Math.min(maxX, Math.max(MARGIN, left)), top: Math.min(maxY, Math.max(MARGIN, top)) };
}

export function readBuddyPos(): BuddyPos | null {
  try {
    const value = JSON.parse(localStorage.getItem(BUDDY_POS_KEY) ?? "null") as BuddyPos | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
  } catch {
    return null;
  }
}

export function writeBuddyPos(pos: BuddyPos | null) {
  try {
    if (pos) localStorage.setItem(BUDDY_POS_KEY, JSON.stringify(pos));
    else localStorage.removeItem(BUDDY_POS_KEY);
  } catch {
    // This tab only.
  }
}
