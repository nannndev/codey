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
