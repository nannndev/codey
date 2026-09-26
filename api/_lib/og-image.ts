import { ImageResponse } from '@vercel/og';
import type { SharedRun } from './share-card.js';

/**
 * 1200×630 preview card, drawn with Satori from plain element objects (no JSX
 * in the API folder). A light card with the WPM large in the middle, so it
 * stands out in dark feeds; amber is the only accent, matching the site.
 */

type Style = Record<string, string | number>;
interface Node { type: string; props: { style?: Style; children?: unknown; src?: string; width?: number; height?: number } }

const h = (type: string, style: Style, ...children: unknown[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const img = (src: string, style: Style): Node => ({ type: 'img', props: { src, style, width: Number(style.width), height: Number(style.height) } });

const AMBER = '#f59e0b';
const ACCENT = '#b45309';
const INK = '#18181b';
const MUTED = '#71717a';

/** Whole numbers read cleaner on a card: "120", but "88.4". */
export function formatWpm(wpm: number) {
  const rounded = Math.round(wpm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function stat(label: string, value: string) {
  return h('div', { flexDirection: 'column', gap: 6 },
    h('div', { fontSize: 20, color: MUTED, letterSpacing: 2, textTransform: 'uppercase' }, label),
    h('div', { fontSize: 38, color: INK }, value),
  );
}

function brand(host: string) {
  return h('div', { alignItems: 'center', gap: 14 },
    h('div', { width: 44, height: 44, borderRadius: 12, background: AMBER, color: INK, fontSize: 26, alignItems: 'center', justifyContent: 'center' }, '</>'),
    h('div', { flexDirection: 'column' },
      h('div', { fontSize: 30, color: INK }, 'Codey'),
      h('div', { fontSize: 20, color: MUTED }, host),
    ),
  );
}

function verifiedPill() {
  return h('div', { padding: '8px 18px', borderRadius: 999, border: `2px solid ${ACCENT}`, color: ACCENT, fontSize: 22, alignItems: 'center', gap: 10 },
    // A drawn check: glyphs outside the bundled font would need a network font fetch.
    h('div', { width: 16, height: 9, borderLeft: `3px solid ${ACCENT}`, borderBottom: `3px solid ${ACCENT}`, transform: 'rotate(-45deg)', marginTop: -4 }),
    'Verified Ranked');
}

export function renderShareImage(run: SharedRun | null, host: string): ImageResponse {
  const wpm = run ? formatWpm(run.wpm) : '';
  const content = run
    ? [
        h('div', { alignItems: 'center', gap: 16 },
          run.avatarUrl
            ? img(run.avatarUrl, { width: 60, height: 60, borderRadius: 30 })
            : h('div', { width: 60, height: 60, borderRadius: 30, background: AMBER, color: INK, fontSize: 30, alignItems: 'center', justifyContent: 'center' }, run.name.slice(0, 1).toUpperCase()),
          h('div', { fontSize: 32, color: INK, maxWidth: 560, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, run.name),
          run.verified ? verifiedPill() : h('div', {}),
        ),
        h('div', { flexDirection: 'column', alignItems: 'center' },
          h('div', { fontSize: wpm.length > 4 ? 220 : 260, lineHeight: 0.85, color: INK, letterSpacing: -10 }, wpm),
          h('div', { fontSize: 34, color: ACCENT, letterSpacing: 12, marginTop: 10 }, 'WORDS PER MINUTE'),
        ),
        h('div', { width: 1072, justifyContent: 'space-between', alignItems: 'flex-end' },
          h('div', { gap: 56 },
            stat('Accuracy', `${run.accuracy.toFixed(1)}%`),
            stat('Language', run.language),
            stat('Format', run.format),
          ),
          brand(host),
        ),
      ]
    : [
        h('div', {}),
        h('div', { flexDirection: 'column', alignItems: 'center', gap: 22 },
          h('div', { fontSize: 104, color: INK, letterSpacing: -4 }, 'Type real code, faster.'),
          h('div', { fontSize: 34, color: MUTED }, 'Snippets from GitHub, daily challenges and live duels.'),
        ),
        h('div', { width: 1072, justifyContent: 'flex-end' }, brand(host)),
      ];

  const root = h('div', { width: 1200, height: 630, position: 'relative', background: '#fafaf9', fontFamily: 'Geist', overflow: 'hidden' },
    h('div', { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, background: 'radial-gradient(circle at 50% 55%, rgba(245,158,11,0.22), rgba(245,158,11,0) 55%)' }),
    h('div', { flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', padding: '48px 64px' }, ...content),
  );

  return new ImageResponse(root as never, { width: 1200, height: 630 });
}
