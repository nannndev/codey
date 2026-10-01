import type { SharedProfile } from './profile-card.js';
import { kapSvg, type KapLook } from '../../src/utils/kap-art.js';
import type { FlameTier } from '../../src/utils/flame-tiers.js';
import { formatWpm } from './og-image.js';

/**
 * README badges: /b/<userId> (or /api/og/<userId>?kind=badge) returns an SVG
 * a developer can put on their GitHub profile. Two styles: `card` (default,
 * with their Kap) and `flat` (a shields.io-sized pill). GitHub proxies README
 * images through camo, which blocks outside fonts and scripts, so everything
 * here is plain shapes and system fonts.
 */

export type BadgeStyle = 'card' | 'flat';
export type BadgeTheme = 'dark' | 'light';

export interface BadgeInput {
  profile: SharedProfile | null;
  kap?: { tier: FlameTier; look: KapLook } | null;
  style?: BadgeStyle;
  theme?: BadgeTheme;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const AMBER = '#f59e0b';

/** Rough text width for a sans-serif face; badges have no font metrics to measure with. */
export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const char of text) {
    if (/[0-9]/.test(char)) units += 0.56;
    else if (/[ilI.,:;'|!]/.test(char)) units += 0.28;
    else if (/[mwMW]/.test(char)) units += 0.84;
    else if (/[A-Z]/.test(char)) units += 0.66;
    else if (char === ' ') units += 0.28;
    else units += 0.54;
  }
  return Math.ceil(units * size * (bold ? 1.06 : 1));
}

function division(profile: SharedProfile | null) {
  return profile?.division ?? null;
}

function cardBadge({ profile, kap, theme = 'dark' }: BadgeInput): string {
  const dark = theme === 'dark';
  const bg = dark ? '#0f1117' : '#ffffff';
  const ink = dark ? '#f4f4f5' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const border = dark ? '#27272a' : '#e4e4e7';
  const width = 440;
  const height = 120;
  const div = division(profile);
  const hasRuns = Boolean(profile?.runs);

  const kapMarkup = kap ? kapSvg(kap.tier, kap.look, 86).replace('<svg ', '<svg x="17" y="13" ') : '';
  const pillText = div?.name ?? 'Codey typist';
  const pillColor = div?.color ?? AMBER;
  // Pale division colours (Gold, Silver) need dark text on a light card.
  const pillInk = dark ? pillColor : ink;
  const pillWidth = textWidth(pillText, 11, true) + 22;

  const wpm = hasRuns ? formatWpm(profile!.bestWpm) : '';
  const wpmWidth = textWidth(wpm, 40, true);
  const where = profile?.bestLanguage && profile.bestLanguage !== 'Mixed' ? profile.bestLanguage : 'code';
  const runs = profile?.runs ?? 0;
  const facts = [`best in ${where}`, `${runs.toLocaleString('en-US')} ${runs === 1 ? 'run' : 'runs'}`, profile?.bestStreak ? `${profile.bestStreak}-day streak` : ''].filter(Boolean).join(' · ');

  const body = hasRuns
    ? `<text x="128" y="78" font-family="${SANS}" font-size="40" font-weight="800" fill="${ink}">${escape(wpm)}</text>`
      + `<text x="${132 + wpmWidth}" y="78" font-family="${SANS}" font-size="15" font-weight="600" fill="${muted}">wpm</text>`
      + `<text x="128" y="101" font-family="${SANS}" font-size="12" fill="${muted}">${escape(facts)}</text>`
    : `<text x="128" y="72" font-family="${SANS}" font-size="20" font-weight="800" fill="${ink}">Typing real code</text>`
      + `<text x="128" y="96" font-family="${SANS}" font-size="12" fill="${muted}">First run coming soon on Codey</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(hasRuns ? `Codey: ${wpm} WPM best on code${div ? `, ${div.name}` : ''}` : 'Codey typing profile')}">`
    + `<title>${escape(profile ? `${profile.name} on Codey` : 'Codey')}</title>`
    + `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${bg}" stroke="${border}"/>`
    + `<rect x="10" y="10" width="100" height="100" rx="14" fill="${AMBER}"/>`
    + (kapMarkup || `<text x="60" y="72" text-anchor="middle" font-family="${SANS}" font-size="34" font-weight="800" fill="#18181b">&lt;/&gt;</text>`)
    + `<text x="128" y="32" font-family="${SANS}" font-size="11" font-weight="800" letter-spacing="2" fill="${AMBER}">CODEY</text>`
    + `<rect x="${width - 14 - pillWidth}" y="17" width="${pillWidth}" height="22" rx="11" fill="${dark ? 'none' : `${pillColor}33`}" stroke="${pillColor}" stroke-width="1.5"/>`
    + `<text x="${width - 14 - pillWidth / 2}" y="32" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="700" fill="${pillInk}">${escape(pillText)}</text>`
    + body
    + `</svg>`;
}

function flatBadge({ profile, theme = 'dark' }: BadgeInput): string {
  const div = division(profile);
  const label = 'Codey';
  const value = profile?.runs ? `${formatWpm(profile.bestWpm)} WPM${div ? ` · ${div.name}` : ''}` : 'typing real code';
  const font = "Verdana,Geneva,'DejaVu Sans',sans-serif";
  // Verdana runs about a fifth wider than the generic estimate, more in bold.
  const left = Math.ceil(textWidth(label, 11) * 1.18) + 28;
  const right = Math.ceil(textWidth(value, 11, true) * 1.24) + 14;
  const width = left + right;
  const color = div?.color ?? AMBER;
  const labelBg = theme === 'light' ? '#e4e4e7' : '#3f3f46';
  const labelInk = theme === 'light' ? '#18181b' : '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img" aria-label="${escape(`${label}: ${value}`)}">`
    + `<title>${escape(`${label}: ${value}`)}</title>`
    + `<clipPath id="r"><rect width="${width}" height="20" rx="4"/></clipPath>`
    + `<g clip-path="url(#r)"><rect width="${left}" height="20" fill="${labelBg}"/><rect x="${left}" width="${right}" height="20" fill="${color}"/></g>`
    // A tiny keycap glyph.
    + `<rect x="6" y="5" width="11" height="10" rx="2.5" fill="${AMBER}"/><rect x="8" y="6.5" width="7" height="5" rx="1.5" fill="#fde68a"/>`
    + `<g font-family="${font}" font-size="11">`
    + `<text x="${left / 2 + 7}" y="14" text-anchor="middle" fill="${labelInk}">${label}</text>`
    + `<text x="${left + right / 2}" y="14" text-anchor="middle" fill="#18181b" font-weight="bold">${escape(value)}</text>`
    + `</g></svg>`;
}

export function renderBadge(input: BadgeInput): string {
  return input.style === 'flat' ? flatBadge(input) : cardBadge(input);
}

export const badgeStyle = (value: string): BadgeStyle => (value === 'flat' ? 'flat' : 'card');
export const badgeTheme = (value: string): BadgeTheme => (value === 'light' ? 'light' : 'dark');
