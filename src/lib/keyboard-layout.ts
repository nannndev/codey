import { FINGER_MAP } from "@/utils/keyboard-analytics";

/** ANSI keyboard layout shared by the 3D keyboard, result card and share image. */

export interface KeyDef {
  id: string;
  label: string;
  /** Glyph printed above the main legend (the shifted character). */
  shift?: string;
  /** Width in keyboard units (1u = one letter key). */
  w?: number;
}

const k = (id: string, label = id, shift?: string, w?: number): KeyDef => ({ id, label, shift, w });

// ANSI layout; each row is 15u wide. Ids match normalizePhysicalKey().
export const KEYBOARD_ROWS: KeyDef[][] = [
  [k("`", "`", "~"), k("1", "1", "!"), k("2", "2", "@"), k("3", "3", "#"), k("4", "4", "$"), k("5", "5", "%"), k("6", "6", "^"), k("7", "7", "&"), k("8", "8", "*"), k("9", "9", "("), k("0", "0", ")"), k("-", "-", "_"), k("=", "=", "+"), k("BACKSPACE", "⌫", undefined, 2)],
  [k("TAB", "Tab", undefined, 1.5), ..."QWERTYUIOP".split("").map((c) => k(c)), k("[", "[", "{"), k("]", "]", "}"), k("\\", "\\", "|", 1.5)],
  [k("CAPS", "Caps", undefined, 1.75), ..."ASDFGHJKL".split("").map((c) => k(c)), k(";", ";", ":"), k("'", "'", "\""), k("ENTER", "Enter", undefined, 2.25)],
  [k("SHIFT_L", "Shift", undefined, 2.25), ..."ZXCVBNM".split("").map((c) => k(c)), k(",", ",", "<"), k(".", ".", ">"), k("/", "/", "?"), k("SHIFT_R", "Shift", undefined, 2.75)],
  [k("CTRL_L", "Ctrl", undefined, 1.5), k("META_L", "◆", undefined, 1.25), k("ALT_L", "Alt", undefined, 1.25), k("SPACE", "", undefined, 7), k("ALT_R", "Alt", undefined, 1.25), k("META_R", "◆", undefined, 1.25), k("CTRL_R", "Ctrl", undefined, 1.5)],
];

// Shifted character -> base key id, derived from the legends above.
const SHIFTED_TO_KEY: Record<string, string> = Object.fromEntries(
  KEYBOARD_ROWS.flat().filter((key) => key.shift).map((key) => [key.shift!, key.id]),
);

/** Which physical keys produce `char`, including the Shift a touch typist would use. */
export function keysForChar(char: string | undefined): string[] {
  if (!char) return [];
  if (char === " ") return ["SPACE"];
  if (char === "\n") return ["ENTER"];
  if (char === "\t") return ["TAB"];
  let id: string | undefined;
  let shifted = false;
  if (/^[a-z]$/.test(char)) id = char.toUpperCase();
  else if (/^[A-Z]$/.test(char)) { id = char; shifted = true; }
  else if (SHIFTED_TO_KEY[char]) { id = SHIFTED_TO_KEY[char]; shifted = true; }
  else if (KEYBOARD_ROWS.some((row) => row.some((key) => key.id === char))) id = char;
  if (!id) return [];
  if (!shifted) return [id];
  // Opposite-hand Shift: a key typed by the left hand pairs with right Shift.
  const leftHand = FINGER_MAP[id]?.finger.startsWith("left");
  return [id, leftHand ? "SHIFT_R" : "SHIFT_L"];
}

/** Physical keys missed in a run, most-missed first, from expected characters. */
export function missedKeys(errors: Array<{ expected: string }>, limit = 6): Array<{ id: string; count: number }> {
  const counts = new Map<string, number>();
  for (const error of errors) {
    const id = keysForChar(error.expected)[0];
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Display label for a key id ("SPACE" -> "Space"). */
export function keyLabel(id: string): string {
  const key = KEYBOARD_ROWS.flat().find((item) => item.id === id);
  if (!key) return id;
  return key.label || "Space";
}
