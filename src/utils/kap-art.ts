/**
 * Kap as SVG markup: the wardrobe catalog, each accessory, and a static
 * "lit" Kap for share cards. The React mascot draws accessories from these
 * same strings, so the app and the server-rendered cards always match.
 * Shared with the API, so no path aliases.
 */
import type { FlameTier } from "./flame-tiers.js";

export type KapColorId = "amber" | "retro" | "ocean" | "sakura" | "matcha" | "graphite" | "obsidian";
export type KapHeadId = "headphones" | "party" | "halo";
export type KapEyesId = "shades" | "nerd" | "monocle";
export type KapWearId = "scarf" | "headband" | "cape";
export type WardrobeSlot = "color" | "head" | "eyes" | "wear";

export interface KapLook {
  color?: KapColorId;
  head?: KapHeadId | null;
  eyes?: KapEyesId | null;
  wear?: KapWearId | null;
  /** League division medal (0 Bronze … 3 Diamond); earned, not picked in the Wardrobe. */
  medal?: number | null;
}

/** Medal colours by league division: face, rim. */
export const MEDAL_COLORS: [string, string][] = [["#f59e0b", "#b45309"], ["#e2e8f0", "#94a3b8"], ["#fde047", "#ca8a04"], ["#a5f3fc", "#0891b2"]];

export interface KapColorway {
  id: KapColorId;
  name: string;
  /** Top face, front skirt, sides and arms; undefined keeps the flame tier's. */
  cap?: [string, string, string];
  /** Face lines, for dark caps. */
  ink?: string;
}

export const KAP_INK = "#1c1917";

export const KAP_COLORS: KapColorway[] = [
  { id: "amber", name: "Amber" },
  { id: "retro", name: "Retro beige", cap: ["#f5f0e1", "#e3dac3", "#b3a78b"] },
  { id: "ocean", name: "Ocean", cap: ["#cffafe", "#67e8f9", "#0891b2"] },
  { id: "sakura", name: "Sakura", cap: ["#fce7f3", "#f9a8d4", "#db2777"] },
  { id: "matcha", name: "Matcha", cap: ["#ecfccb", "#bef264", "#65a30d"] },
  { id: "graphite", name: "Graphite", cap: ["#e4e4e7", "#a1a1aa", "#52525b"] },
  { id: "obsidian", name: "Obsidian", cap: ["#52525b", "#3f3f46", "#18181b"], ink: "#fafafa" },
];

export function colorway(id: KapColorId | undefined): KapColorway {
  return KAP_COLORS.find((color) => color.id === id) ?? KAP_COLORS[0];
}

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

export const isUnlocked = (item: WardrobeItem, earned: ReadonlySet<string>) => item.requires === null || earned.has(item.requires);

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

/* ---- Accessories, in the 240×258 artwork space ---- */

/** Drawn before the body: only the parts outside the keycap show. */
export function behindMarkup(look: KapLook): string {
  let out = "";
  if (look.wear === "cape") {
    out += '<path d="M74 84 Q30 150 16 222 Q70 210 120 222 Q170 210 224 222 Q210 150 166 84 Z" fill="#dc2626"/>'
      + '<path d="M74 84 Q38 146 26 212 Q42 208 56 210 Q58 150 84 92 Z" fill="#991b1b"/>'
      + '<path d="M166 84 Q202 146 214 212 Q198 208 184 210 Q182 150 156 92 Z" fill="#b91c1c"/>';
  }
  if (look.head === "halo") {
    out += '<g class="kap-halo"><ellipse cx="120" cy="18" rx="46" ry="11" fill="none" stroke="#fde047" stroke-width="7"/>'
      + '<ellipse cx="120" cy="18" rx="46" ry="11" fill="none" stroke="#fef9c3" stroke-width="2"/></g>';
  }
  return out;
}

/** Drawn over the face and flame. */
export function frontMarkup(look: KapLook, ink: string): string {
  let out = "";
  if (look.wear === "scarf") {
    out += '<path d="M62 124 Q120 142 178 124 L181 140 Q120 158 59 140 Z" fill="#dc2626"/>'
      + '<path d="M62 124 Q120 142 178 124 L179 130 Q120 148 61 130 Z" fill="#f87171"/>'
      + '<path d="M154 138 L168 180 L153 183 L146 142 Z" fill="#b91c1c"/>'
      + '<path d="M156 176 l12 4 M154 170 l12 4" stroke="#fecaca" stroke-width="2"/>';
  }
  if (look.wear === "headband") {
    out += '<path d="M67 131 L173 131 L175 143 L65 143 Z" fill="#ef4444"/>'
      + '<path d="M67 131 L173 131 L173.6 135 L66.4 135 Z" fill="#fca5a5"/>'
      + '<path d="M174 135 q16 -8 32 -2 q-14 4 -30 10 z" fill="#dc2626"/>'
      + '<path d="M174 139 q14 6 26 18 q-16 -4 -27 -12 z" fill="#b91c1c"/>'
      + '<circle cx="175" cy="138" r="5" fill="#b91c1c"/>';
  }
  if (look.eyes === "shades") {
    // Pixel shades, drawn on a 4px grid.
    out += '<path d="M80 146 h80 v6 h-80 z" fill="#0a0a0a"/>'
      + '<path d="M84 152 h28 v8 h-4 v4 h-20 v-4 h-4 z M128 152 h28 v8 h-4 v4 h-20 v-4 h-4 z" fill="#0a0a0a"/>'
      + '<path d="M88 154 h4 v4 h-4 z M92 158 h4 v4 h-4 z M132 154 h4 v4 h-4 z M136 158 h4 v4 h-4 z" fill="#fafafa"/>';
  }
  if (look.eyes === "nerd") {
    out += `<g stroke="${ink}" stroke-width="4" fill="none">`
      + '<circle cx="98" cy="157" r="14" fill="#fff" fill-opacity=".25"/>'
      + '<circle cx="142" cy="157" r="14" fill="#fff" fill-opacity=".25"/>'
      + '<path d="M112 155 q8 -6 16 0"/>'
      + '<path d="M84 154 L68 150 M156 154 L172 150" stroke-linecap="round"/></g>';
  }
  if (look.eyes === "monocle") {
    out += '<circle cx="142" cy="157" r="14" fill="#fff" fill-opacity=".2" stroke="#ca8a04" stroke-width="4"/>'
      + '<path d="M152 167 q10 14 2 30" stroke="#ca8a04" stroke-width="2" fill="none" stroke-dasharray="3 3"/>';
  }
  if (look.head === "headphones") {
    const band = "M47 128 C 38 -6, 202 -6, 193 128";
    out += `<path d="${band}" stroke="#18181b" stroke-width="12" fill="none" stroke-linecap="round"/>`
      + `<path d="${band}" stroke="#52525b" stroke-width="5" fill="none" stroke-linecap="round"/>`
      + '<rect x="30" y="108" width="28" height="50" rx="12" fill="#18181b"/>'
      + '<rect x="182" y="108" width="28" height="50" rx="12" fill="#18181b"/>'
      + '<rect x="34" y="114" width="8" height="38" rx="4" fill="#f59e0b"/>'
      + '<rect x="198" y="114" width="8" height="38" rx="4" fill="#f59e0b"/>';
  }
  if (typeof look.medal === "number" && MEDAL_COLORS[look.medal]) {
    const [face, rim] = MEDAL_COLORS[look.medal];
    out += '<path d="M138 146 L150 172 L158 168 L148 146 Z" fill="#2563eb"/><path d="M168 146 L158 172 L150 168 L160 146 Z" fill="#dc2626"/>'
      + `<circle cx="154" cy="180" r="12" fill="${face}" stroke="${rim}" stroke-width="3"/>`
      + `<path d="M154 173 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill="${rim}"/>`;
  }
  if (look.head === "party") {
    out += '<g transform="translate(-30 -34) scale(1.4) rotate(-18 88 80)">'
      + '<path d="M74 84 L88 26 L104 84 Z" fill="#f472b6"/>'
      + '<path d="M78.5 66 L98.5 62 L101 72 L76.5 76 Z M84 44 L93 42 L95.5 52 L81.5 54 Z" fill="#fde047"/>'
      + '<path d="M72 84 Q88 90 106 84" stroke="#db2777" stroke-width="4" fill="none" stroke-linecap="round"/>'
      + '<circle cx="88" cy="24" r="7" fill="#fde047"/></g>';
  }
  return out;
}

/* ---- A static, happy Kap for share cards ---- */

function flame(cx: number, base: number, scale: number, outer: string, inner: string) {
  const h = 78 * scale;
  const w = 40 * scale;
  return `<path d="M${cx} ${base - h} C ${cx + w * 0.95} ${base - h * 0.55}, ${cx + w} ${base - h * 0.12}, ${cx} ${base} C ${cx - w} ${base - h * 0.12}, ${cx - w * 0.95} ${base - h * 0.5}, ${cx - w * 0.3} ${base - h * 0.72} C ${cx - w * 0.22} ${base - h * 0.46}, ${cx} ${base - h * 0.56}, ${cx} ${base - h} Z" fill="${outer}"/>`
    + `<path d="M${cx} ${base - h * 0.58} C ${cx + w * 0.52} ${base - h * 0.32}, ${cx + w * 0.46} ${base - h * 0.05}, ${cx} ${base} C ${cx - w * 0.46} ${base - h * 0.05}, ${cx - w * 0.46} ${base - h * 0.32}, ${cx} ${base - h * 0.58} Z" fill="${inner}"/>`;
}

const TOP_FACE = "M80 76 L160 76 Q170 76 171 86 L174 122 Q174 132 164 132 L76 132 Q66 132 66 122 L69 86 Q70 76 80 76 Z";

/** Kap with arms up and the flame burning, as a standalone SVG document. */
export function kapSvg(tier: FlameTier, look: KapLook = {}, width = 240): string {
  const paint = colorway(look.color);
  const [top, front, side] = paint.cap ?? tier.cap;
  const ink = paint.ink ?? KAP_INK;
  const s = tier.scale;
  const cx = 120;
  const y = 156;
  const crown = tier.crown ? `<path d="M96 ${108 - 78 * s + 6} l6 -22 12 12 6 -18 6 18 12 -12 6 22z" fill="#facc15" stroke="#a16207" stroke-width="2" stroke-linejoin="round"/>` : "";
  const eyes = tier.crown
    ? [cx - 22, cx + 22].map((x) => `<path d="M${x} ${y - 9} l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="${ink}"/>`).join("")
    : `<path d="M${cx - 31} ${y + 4} q9 -13 18 0 M${cx + 13} ${y + 4} q9 -13 18 0" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const body = [
    behindMarkup(look),
    '<rect x="92" y="196" width="14" height="22" rx="5" fill="#3f3f46"/><rect x="134" y="196" width="14" height="22" rx="5" fill="#3f3f46"/>',
    '<rect x="86" y="212" width="24" height="9" rx="4.5" fill="#27272a"/><rect x="130" y="212" width="24" height="9" rx="4.5" fill="#27272a"/>',
    `<path d="M52 150 q-18 -10 -20 -30" stroke="${side}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
    `<path d="M188 150 q18 -10 20 -30" stroke="${side}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
    `<path d="M58 200 Q48 200 50 188 L64 84 Q66 72 78 72 L162 72 Q174 72 176 84 L190 188 Q192 200 182 200 Z" fill="${side}"/>`,
    `<path d="M62 196 Q56 196 57 188 L70 128 L170 128 L183 188 Q184 196 178 196 Z" fill="${front}"/>`,
    `<path d="${TOP_FACE}" fill="${top}"/>`,
    `<path d="${TOP_FACE}" fill="url(#kapdish)"/>`,
    `<ellipse cx="120" cy="106" rx="${26 * s}" ry="6" fill="#000" opacity=".12"/>`,
    flame(120, 108, s, tier.flame, tier.core),
    crown,
    eyes,
    `<path d="M${cx - 13} ${y + 16} q13 16 26 0 z" fill="${ink}"/><path d="M${cx - 6} ${y + 24} q6 4 12 0" fill="#fb7185"/>`,
    `<ellipse cx="${cx - 38}" cy="${y + 16}" rx="7" ry="4.5" fill="#fb7185" opacity=".45"/><ellipse cx="${cx + 38}" cy="${y + 16}" rx="7" ry="4.5" fill="#fb7185" opacity=".45"/>`,
    frontMarkup(look, ink),
  ].join("");
  const height = Math.round((width * 258) / 240);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -30 240 258" width="${width}" height="${height}">`
    + '<defs><linearGradient id="kapdish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".10"/><stop offset=".55" stop-color="#000" stop-opacity="0"/></linearGradient></defs>'
    + `<ellipse cx="120" cy="222" rx="74" ry="8" fill="#000" opacity=".3"/>${body}</svg>`;
}

export function kapDataUri(tier: FlameTier, look: KapLook = {}, width = 240): string {
  const svg = kapSvg(tier, look, width);
  const base64 = typeof btoa === "function" ? btoa(svg) : Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
