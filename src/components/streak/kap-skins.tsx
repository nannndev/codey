/**
 * Kap's wardrobe: keycap colourways plus one item per slot (head, eyes, wear).
 * Items are drawn in the 240×258 Kap artwork space; the flame sits at x 120
 * on the top face, the eyes at y 156, so nothing here covers either.
 */

export type KapColorId = "amber" | "retro" | "ocean" | "sakura" | "matcha" | "graphite" | "obsidian";
export type KapHeadId = "headphones" | "party" | "halo";
export type KapEyesId = "shades" | "nerd" | "monocle";
export type KapWearId = "scarf" | "headband" | "cape";

export interface KapLook {
  color?: KapColorId;
  head?: KapHeadId | null;
  eyes?: KapEyesId | null;
  wear?: KapWearId | null;
}

export interface KapColorway {
  id: KapColorId;
  name: string;
  /** Top face, front skirt, sides and arms; undefined keeps the flame tier's. */
  cap?: [string, string, string];
  /** Face lines, for dark caps. */
  ink?: string;
}

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

/** Drawn before the body: only the parts outside the keycap show. */
export function KapBehind({ look }: { look: KapLook }) {
  return (
    <>
      {look.wear === "cape" && (
        <g>
          <path d="M74 84 Q30 150 16 222 Q70 210 120 222 Q170 210 224 222 Q210 150 166 84 Z" fill="#dc2626" />
          <path d="M74 84 Q38 146 26 212 Q42 208 56 210 Q58 150 84 92 Z" fill="#991b1b" />
          <path d="M166 84 Q202 146 214 212 Q198 208 184 210 Q182 150 156 92 Z" fill="#b91c1c" />
        </g>
      )}
      {look.head === "halo" && (
        <g className="kap-halo">
          <ellipse cx="120" cy="18" rx="46" ry="11" fill="none" stroke="#fde047" strokeWidth="7" />
          <ellipse cx="120" cy="18" rx="46" ry="11" fill="none" stroke="#fef9c3" strokeWidth="2" />
        </g>
      )}
    </>
  );
}

/** Drawn over the face and flame. */
export function KapFront({ look, ink }: { look: KapLook; ink: string }) {
  return (
    <>
      {look.wear === "scarf" && (
        <g>
          <path d="M62 124 Q120 142 178 124 L181 140 Q120 158 59 140 Z" fill="#dc2626" />
          <path d="M62 124 Q120 142 178 124 L179 130 Q120 148 61 130 Z" fill="#f87171" />
          <path d="M154 138 L168 180 L153 183 L146 142 Z" fill="#b91c1c" />
          <path d="M156 176 l12 4 M154 170 l12 4" stroke="#fecaca" strokeWidth="2" />
        </g>
      )}
      {look.wear === "headband" && (
        <g>
          <path d="M67 131 L173 131 L175 143 L65 143 Z" fill="#ef4444" />
          <path d="M67 131 L173 131 L173.6 135 L66.4 135 Z" fill="#fca5a5" />
          <path d="M174 135 q16 -8 32 -2 q-14 4 -30 10 z" fill="#dc2626" />
          <path d="M174 139 q14 6 26 18 q-16 -4 -27 -12 z" fill="#b91c1c" />
          <circle cx="175" cy="138" r="5" fill="#b91c1c" />
        </g>
      )}
      {look.eyes === "shades" && (
        <g>
          {/* Pixel shades, drawn on an 4px grid. */}
          <path d="M80 146 h80 v6 h-80 z" fill="#0a0a0a" />
          <path d="M84 152 h28 v8 h-4 v4 h-20 v-4 h-4 z M128 152 h28 v8 h-4 v4 h-20 v-4 h-4 z" fill="#0a0a0a" />
          <path d="M88 154 h4 v4 h-4 z M92 158 h4 v4 h-4 z M132 154 h4 v4 h-4 z M136 158 h4 v4 h-4 z" fill="#fafafa" />
        </g>
      )}
      {look.eyes === "nerd" && (
        <g stroke={ink} strokeWidth="4" fill="none">
          <circle cx="98" cy="157" r="14" fill="#fff" fillOpacity=".25" />
          <circle cx="142" cy="157" r="14" fill="#fff" fillOpacity=".25" />
          <path d="M112 155 q8 -6 16 0" />
          <path d="M84 154 L68 150 M156 154 L172 150" strokeLinecap="round" />
        </g>
      )}
      {look.eyes === "monocle" && (
        <g>
          <circle cx="142" cy="157" r="14" fill="#fff" fillOpacity=".2" stroke="#ca8a04" strokeWidth="4" />
          <path d="M152 167 q10 14 2 30" stroke="#ca8a04" strokeWidth="2" fill="none" strokeDasharray="3 3" />
        </g>
      )}
      {look.head === "headphones" && (
        <g>
          <path d="M47 128 C 38 -6, 202 -6, 193 128" stroke="#18181b" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M47 128 C 38 -6, 202 -6, 193 128" stroke="#52525b" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="30" y="108" width="28" height="50" rx="12" fill="#18181b" />
          <rect x="182" y="108" width="28" height="50" rx="12" fill="#18181b" />
          <rect x="34" y="114" width="8" height="38" rx="4" fill="#f59e0b" />
          <rect x="198" y="114" width="8" height="38" rx="4" fill="#f59e0b" />
        </g>
      )}
      {look.head === "party" && (
        <g transform="translate(-30 -34) scale(1.4) rotate(-18 88 80)">
          <path d="M74 84 L88 26 L104 84 Z" fill="#f472b6" />
          <path d="M78.5 66 L98.5 62 L101 72 L76.5 76 Z M84 44 L93 42 L95.5 52 L81.5 54 Z" fill="#fde047" />
          <path d="M72 84 Q88 90 106 84" stroke="#db2777" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="88" cy="24" r="7" fill="#fde047" />
        </g>
      )}
    </>
  );
}
