import { useId } from "react";
import { cn } from "@/lib/utils";
import type { FlameTier, StreakMood } from "@/lib/streak";

/**
 * Kap, the streak mascot: an SA-profile keycap on MX-stem feet with a flame
 * on its top face. The mood sets the face and pose, the tier sets the flame.
 */

interface KapMascotProps {
  mood: StreakMood;
  tier: FlameTier | null;
  /** Rendered width in px; height follows the 240×258 artwork. */
  size?: number;
  /** Idle motion: breathing, flame flicker, blinking. */
  animate?: boolean;
  /** One celebratory hop, e.g. when the streak goes up. */
  jump?: boolean;
  className?: string;
  title?: string;
}

const INK = "#1c1917";
const SLEEP_CAP: [string, string, string] = ["#e4e4e7", "#c4c4cc", "#9f9fa9"];
const RISK_CAP: [string, string, string] = ["#fff7e6", "#f4dfb6", "#d9bd86"];

function flamePaths(cx: number, base: number, scale: number, outer: string, inner: string) {
  const h = 78 * scale;
  const w = 40 * scale;
  return (
    <>
      <path d={`M${cx} ${base - h} C ${cx + w * 0.95} ${base - h * 0.55}, ${cx + w} ${base - h * 0.12}, ${cx} ${base} C ${cx - w} ${base - h * 0.12}, ${cx - w * 0.95} ${base - h * 0.5}, ${cx - w * 0.3} ${base - h * 0.72} C ${cx - w * 0.22} ${base - h * 0.46}, ${cx} ${base - h * 0.56}, ${cx} ${base - h} Z`} fill={outer} />
      <path d={`M${cx} ${base - h * 0.58} C ${cx + w * 0.52} ${base - h * 0.32}, ${cx + w * 0.46} ${base - h * 0.05}, ${cx} ${base} C ${cx - w * 0.46} ${base - h * 0.05}, ${cx - w * 0.46} ${base - h * 0.32}, ${cx} ${base - h * 0.58} Z`} fill={inner} />
    </>
  );
}

function Star({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y - 9} l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z`} fill={INK} />;
}

function Face({ mood, crown }: { mood: StreakMood; crown: boolean }) {
  const cx = 120;
  const y = 156;
  const smile = (
    <>
      <path d={`M${cx - 13} ${y + 16} q13 16 26 0 z`} fill={INK} />
      <path d={`M${cx - 6} ${y + 24} q6 4 12 0`} fill="#fb7185" />
    </>
  );
  return (
    <g>
      <g className="kap-eyes">
        {mood === "sleep" && <path d={`M${cx - 30} ${y} q8 7 16 0 M${cx + 14} ${y} q8 7 16 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />}
        {mood === "risk" && (
          <>
            <ellipse cx={cx - 22} cy={y + 2} rx="5.5" ry="7" fill={INK} />
            <ellipse cx={cx + 22} cy={y + 2} rx="5.5" ry="7" fill={INK} />
            <circle cx={cx - 20} cy={y - 1} r="2" fill="#fff" />
            <circle cx={cx + 24} cy={y - 1} r="2" fill="#fff" />
          </>
        )}
        {mood === "lit" && !crown && <path d={`M${cx - 31} ${y + 4} q9 -13 18 0 M${cx + 13} ${y + 4} q9 -13 18 0`} stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />}
        {mood === "lit" && crown && (
          <>
            <Star x={cx - 22} y={y} />
            <Star x={cx + 22} y={y} />
          </>
        )}
      </g>
      {mood === "risk" && <path d={`M${cx - 32} ${y - 8} l13 -6 M${cx + 32} ${y - 8} l-13 -6`} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />}
      {mood === "sleep" && <ellipse cx={cx} cy={y + 20} rx="4.5" ry="3.5" fill={INK} />}
      {mood === "risk" && <path d={`M${cx - 10} ${y + 24} q10 -8 20 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />}
      {mood === "lit" && smile}
      {mood !== "sleep" && (
        <>
          <ellipse cx={cx - 38} cy={y + 16} rx="7" ry="4.5" fill="#fb7185" opacity=".45" />
          <ellipse cx={cx + 38} cy={y + 16} rx="7" ry="4.5" fill="#fb7185" opacity=".45" />
        </>
      )}
    </g>
  );
}

export function KapMascot({ mood, tier, size = 120, animate = true, jump = false, className, title }: KapMascotProps) {
  const id = useId().replace(/:/g, "");
  const cap = mood === "sleep" ? SLEEP_CAP : mood === "risk" ? RISK_CAP : tier?.cap ?? SLEEP_CAP;
  const [top, front, side] = cap;
  // At risk, the flame shrinks to an ember of its usual colour.
  const flameScale = mood === "sleep" || !tier ? 0 : mood === "risk" ? Math.min(0.55, tier.scale * 0.6) : tier.scale;
  const crown = mood === "lit" && Boolean(tier?.crown);
  const armsUp = mood === "lit";

  return (
    <svg
      viewBox="0 -30 240 258"
      width={size}
      height={(size * 258) / 240}
      className={cn("kap", animate && "kap--animate", jump && "kap--jump", `kap--${mood}`, className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`kap-dish-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".10" />
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse className="kap-shadow" cx="120" cy="222" rx="74" ry="8" fill="#000" opacity=".3" />
      <g className="kap-body">
        <rect x="92" y="196" width="14" height="22" rx="5" fill="#3f3f46" />
        <rect x="134" y="196" width="14" height="22" rx="5" fill="#3f3f46" />
        <rect x="86" y="212" width="24" height="9" rx="4.5" fill="#27272a" />
        <rect x="130" y="212" width="24" height="9" rx="4.5" fill="#27272a" />
        {armsUp ? (
          <>
            <path className="kap-arm kap-arm--left" d="M52 150 q-18 -10 -20 -30" stroke={side} strokeWidth="9" fill="none" strokeLinecap="round" />
            <path className="kap-arm kap-arm--right" d="M188 150 q18 -10 20 -30" stroke={side} strokeWidth="9" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M52 158 q-14 8 -16 22" stroke={side} strokeWidth="9" fill="none" strokeLinecap="round" />
            <path d="M188 158 q14 8 16 22" stroke={side} strokeWidth="9" fill="none" strokeLinecap="round" />
          </>
        )}
        <path d="M58 200 Q48 200 50 188 L64 84 Q66 72 78 72 L162 72 Q174 72 176 84 L190 188 Q192 200 182 200 Z" fill={side} />
        <path d="M62 196 Q56 196 57 188 L70 128 L170 128 L183 188 Q184 196 178 196 Z" fill={front} />
        <path d="M80 76 L160 76 Q170 76 171 86 L174 122 Q174 132 164 132 L76 132 Q66 132 66 122 L69 86 Q70 76 80 76 Z" fill={top} />
        <path d="M80 76 L160 76 Q170 76 171 86 L174 122 Q174 132 164 132 L76 132 Q66 132 66 122 L69 86 Q70 76 80 76 Z" fill={`url(#kap-dish-${id})`} />
        {tier && flameScale > 0 && (
          <g className="kap-flame">
            <ellipse cx="120" cy="106" rx={26 * flameScale} ry="6" fill="#000" opacity=".12" />
            {flamePaths(120, 108, flameScale, tier.flame, tier.core)}
          </g>
        )}
        {crown && <path d={`M96 ${108 - 78 * flameScale + 6} l6 -22 12 12 6 -18 6 18 12 -12 6 22z`} fill="#facc15" stroke="#a16207" strokeWidth="2" strokeLinejoin="round" />}
        <Face mood={mood} crown={crown} />
        {mood === "risk" && <path className="kap-sweat" d="M178 120 q7 11 0 15 q-7 -4 0 -15z" fill="#7dd3fc" />}
      </g>
      {mood === "sleep" && (
        <g className="kap-zzz" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          <text x="180" y="62" fontSize="22" fill="#a1a1aa">z</text>
          <text x="196" y="46" fontSize="16" fill="#71717a">z</text>
        </g>
      )}
    </svg>
  );
}
