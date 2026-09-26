import { useId } from "react";
import {
  CalendarCheck,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Gauge,
  Gem,
  Hourglass,
  Keyboard,
  Languages,
  Lock,
  Moon,
  ShieldCheck,
  Sunrise,
  Swords,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TIER_NAMES, TIER_NUMERALS, type FamilyId, type SingleId, type Tier } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/** Enamel (the colored face) per family: [light, base, deep]. */
const ENAMEL: Record<FamilyId | SingleId, [string, string, string]> = {
  speed: ["#fcd34d", "#f59e0b", "#92400e"],
  precision: ["#67e8f9", "#06b6d4", "#155e75"],
  streak: ["#fdba74", "#ea4a0c", "#7c1d0a"],
  runs: ["#93c5fd", "#3b82f6", "#1e3a8a"],
  polyglot: ["#c4b5fd", "#8b5cf6", "#4c1d95"],
  time: ["#5eead4", "#14b8a6", "#134e4a"],
  keys: ["#cbd5e1", "#64748b", "#1e293b"],
  combo: ["#f9a8d4", "#ec4899", "#831843"],
  duel: ["#fca5a5", "#ef4444", "#7f1d1d"],
  daily: ["#fde047", "#eab308", "#713f12"],
  ranked: ["#6ee7b7", "#10b981", "#064e3b"],
  flawless: ["#a7f3d0", "#34d399", "#065f46"],
  party: ["#fda4af", "#f43f5e", "#881337"],
  "night-owl": ["#a5b4fc", "#6366f1", "#1e1b4b"],
  "early-bird": ["#fed7aa", "#fb923c", "#7c2d12"],
};

export const BADGE_ICONS: Record<FamilyId | SingleId, LucideIcon> = {
  speed: Gauge,
  precision: Crosshair,
  streak: Flame,
  runs: Dumbbell,
  polyglot: Languages,
  time: Hourglass,
  keys: Keyboard,
  combo: Zap,
  duel: Swords,
  daily: CalendarCheck,
  ranked: ShieldCheck,
  flawless: Gem,
  party: Crown,
  "night-owl": Moon,
  "early-bird": Sunrise,
};

/** Rim metal per tier; one-off feats get onyx with a gold plate. Stops: highlight, body, shadow. */
const METAL: Record<Tier | "special", [string, string, string, string]> = {
  1: ["#fbd5b5", "#c9834f", "#8a4b23", "#5a2e12"],
  2: ["#ffffff", "#d3d9e1", "#8f99a6", "#5b6470"],
  3: ["#fff6c7", "#f5c542", "#b27a0c", "#6f4a05"],
  4: ["#f4fdff", "#b9ecf8", "#5fb4d1", "#2d6f88"],
  special: ["#9aa0b4", "#4a4f63", "#262a38", "#12141c"],
};
const PLATE: Record<Tier | "special", [string, string]> = {
  1: ["#f0b98d", "#9c5a2c"],
  2: ["#f4f6f9", "#9aa3af"],
  3: ["#ffe68a", "#c68a12"],
  4: ["#e9fbff", "#7cc7de"],
  special: ["#ffe68a", "#c68a12"],
};

/** Pointy-top hexagon with rounded corners, as an SVG path. */
function roundedHex(cx: number, cy: number, radius: number, corner: number) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 90);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  });
  const lerp = (a: readonly [number, number], b: readonly [number, number], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const side = radius; // a regular hexagon's side equals its radius
  const t = corner / side;
  let path = "";
  points.forEach((point, index) => {
    const prev = points[(index + 5) % 6];
    const next = points[(index + 1) % 6];
    const start = lerp(point, prev, t);
    const end = lerp(point, next, t);
    path += `${index === 0 ? "M" : "L"}${start[0].toFixed(2)},${start[1].toFixed(2)}Q${point[0].toFixed(2)},${point[1].toFixed(2)} ${end[0].toFixed(2)},${end[1].toFixed(2)}`;
  });
  return `${path}Z`;
}

const OUTER = roundedHex(50, 48, 44, 7);
const BEVEL = roundedHex(50, 48, 40.5, 6);
const FACE = roundedHex(50, 48, 35, 5);
/** Rivet positions near each corner of the rim. */
const RIVETS = Array.from({ length: 6 }, (_, index) => {
  const angle = (Math.PI / 180) * (60 * index - 90);
  return [50 + 39.6 * Math.cos(angle), 48 + 39.6 * Math.sin(angle)] as const;
});

function Sparkle({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const s = size;
  return <path d={`M${x},${y - s}Q${x},${y} ${x + s},${y}Q${x},${y} ${x},${y + s}Q${x},${y} ${x - s},${y}Q${x},${y} ${x},${y - s}Z`} fill={color} />;
}

export interface BadgeProps {
  kind: FamilyId | SingleId;
  /** Omit for one-off feats. */
  tier?: Tier;
  locked?: boolean;
  size?: number;
  className?: string;
  /** Accessible name; defaults to the tier and kind. */
  label?: string;
}

/**
 * An enamel medallion: metal rim by tier, enamel face by family, the
 * family glyph, and a plate with the tier numeral. Gold adds ribbons,
 * Diamond adds ribbons and sparkles. Locked badges render as bare steel.
 */
export function AchievementBadge({ kind, tier, locked = false, size = 88, className, label }: BadgeProps) {
  const uid = useId().replace(/:/g, "");
  const grade = tier ?? "special";
  const metal = METAL[grade];
  const plate = PLATE[grade];
  const enamel = ENAMEL[kind];
  const Icon = BADGE_ICONS[kind];
  const ribbons = !locked && (tier === undefined || tier >= 3);
  const id = (name: string) => `${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 100 112"
      width={size}
      height={size * 1.12}
      role="img"
      aria-label={label ?? `${tier ? TIER_NAMES[tier] : "Special"} ${kind} badge${locked ? ", locked" : ""}`}
      className={cn("achievement-badge overflow-visible", locked && "is-locked", className)}
    >
      <defs>
        <linearGradient id={id("metal")} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={metal[0]} />
          <stop offset="0.38" stopColor={metal[1]} />
          <stop offset="0.72" stopColor={metal[2]} />
          <stop offset="1" stopColor={metal[3]} />
        </linearGradient>
        <linearGradient id={id("bevel")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={id("enamel")} cx="0.42" cy="0.3" r="0.8">
          <stop offset="0" stopColor={enamel[0]} />
          <stop offset="0.55" stopColor={enamel[1]} />
          <stop offset="1" stopColor={enamel[2]} />
        </radialGradient>
        <linearGradient id={id("plate")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={plate[0]} />
          <stop offset="1" stopColor={plate[1]} />
        </linearGradient>
        <linearGradient id={id("ribbon")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={enamel[1]} />
          <stop offset="1" stopColor={enamel[2]} />
        </linearGradient>
        <linearGradient id={id("shine")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id("face")}>
          <path d={FACE} />
        </clipPath>
        <filter id={id("drop")} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <filter id={id("glyph")} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.8" floodColor={enamel[2]} floodOpacity="0.9" />
        </filter>
        <radialGradient id={id("halo")} cx="0.5" cy="0.45" r="0.5">
          <stop offset="0.55" stopColor="#bdf0ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#bdf0ff" stopOpacity="0" />
        </radialGradient>
        <filter id={id("mute")}>
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.85" intercept="0.05" />
            <feFuncG type="linear" slope="0.85" intercept="0.05" />
            <feFuncB type="linear" slope="0.9" intercept="0.06" />
          </feComponentTransfer>
        </filter>
      </defs>

      <g filter={locked ? `url(#${id("mute")})` : undefined} opacity={locked ? 0.55 : 1}>
        {ribbons && (
          <g>
            <path d="M33,74 L24,106 L33.5,100 L40,109 L47,80 Z" fill={`url(#${id("ribbon")})`} />
            <path d="M67,74 L76,106 L66.5,100 L60,109 L53,80 Z" fill={`url(#${id("ribbon")})`} />
            <path d="M33,74 L24,106 L33.5,100 Z" fill="#000" opacity="0.18" />
            <path d="M67,74 L76,106 L66.5,100 Z" fill="#000" opacity="0.18" />
          </g>
        )}

        {!locked && tier === 4 && <circle className="badge-halo" cx="50" cy="48" r="56" fill={`url(#${id("halo")})`} />}
        <g filter={`url(#${id("drop")})`}>
          <path d={OUTER} fill={`url(#${id("metal")})`} />
        </g>
        <path d={OUTER} fill="none" stroke={`url(#${id("bevel")})`} strokeWidth="1.4" />
        <path d={BEVEL} fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
        {/* Silver and up are riveted: the rim reads as heavier metal with each tier. */}
        {(tier ?? 0) >= 2 &&
          RIVETS.map(([x, y], index) =>
            index === 3 ? null : (
              <g key={index}>
                <circle cx={x} cy={y} r="1.7" fill={metal[3]} opacity="0.55" />
                <circle cx={x - 0.35} cy={y - 0.35} r="1.25" fill={metal[0]} />
              </g>
            )
          )}

        <path d={FACE} fill={`url(#${id("enamel")})`} />
        <g clipPath={`url(#${id("face")})`}>
          {/* Guilloché rings: fine engraving under the enamel. */}
          {[8, 14, 20, 26, 32].map((r) => (
            <circle key={r} cx="50" cy="48" r={r} fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="0.7" />
          ))}
          <ellipse cx="41" cy="27" rx="32" ry="15" fill="#fff" opacity="0.17" />
          {!locked && <rect className="badge-shine" x="-40" y="0" width="28" height="100" fill={`url(#${id("shine")})`} transform="skewX(-18)" />}
        </g>
        <path d={FACE} fill="none" stroke={metal[3]} strokeOpacity="0.8" strokeWidth="1.3" />
        <path d={FACE} fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.6" transform="translate(0 0.6)" />

        <g filter={`url(#${id("glyph")})`}>
          <Icon x={34} y={31} width={32} height={32} color="#fff" strokeWidth={2.1} absoluteStrokeWidth={false} />
        </g>

        {/* Plate with the tier numeral (a star for one-off feats). */}
        <g>
          <rect x="35" y="80" width="30" height="14" rx="3.5" fill={`url(#${id("plate")})`} stroke={metal[3]} strokeWidth="0.9" />
          <rect x="36.2" y="81" width="27.6" height="5" rx="2.5" fill="#fff" opacity="0.35" />
          {locked ? (
            <Lock x={45} y={82.5} width={10} height={10} color={metal[3]} strokeWidth={2.6} />
          ) : tier ? (
            <text x="50" y="90.6" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="ui-serif, Georgia, serif" letterSpacing="0.6" fill={plate[1] === "#9aa3af" ? "#3f4650" : "#3b2206"} opacity="0.85">
              {TIER_NUMERALS[tier]}
            </text>
          ) : (
            <path d="M50,82.4 L51.9,86.2 L56,86.7 L53,89.5 L53.8,93.4 L50,91.5 L46.2,93.4 L47,89.5 L44,86.7 L48.1,86.2 Z" fill="#6f4a05" opacity="0.85" />
          )}
        </g>

        {!locked && tier === 4 && (
          <g className="badge-sparkles">
            <Sparkle x={86} y={14} size={5} color="#ffffff" />
            <Sparkle x={14} y={30} size={3.2} color="#e0f7ff" />
            <Sparkle x={84} y={70} size={2.6} color="#ffffff" />
          </g>
        )}
      </g>
    </svg>
  );
}
