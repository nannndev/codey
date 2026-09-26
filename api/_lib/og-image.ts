import { ImageResponse } from '@vercel/og';
import type { SharedRun } from './share-card.js';

/**
 * 1200×630 preview card, drawn with Satori from plain element objects (no JSX
 * in the API folder). Dark background, the player, a large WPM, and the
 * supporting numbers; amber is the only accent, matching the site.
 */

type Style = Record<string, string | number>;
interface Node { type: string; props: { style?: Style; children?: unknown; src?: string; width?: number; height?: number } }

const h = (type: string, style: Style, ...children: unknown[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const img = (src: string, style: Style): Node => ({ type: 'img', props: { src, style, width: Number(style.width), height: Number(style.height) } });

const AMBER = '#f59e0b';
const INK = '#f4f4f5';
const MUTED = '#a1a1aa';

function stat(label: string, value: string) {
  return h('div', { flexDirection: 'column', gap: 6 },
    h('div', { fontSize: 22, color: MUTED, letterSpacing: 2, textTransform: 'uppercase' }, label),
    h('div', { fontSize: 40, color: INK }, value),
  );
}

function codeLines() {
  // Decorative, faint "editor" lines so the card reads as a coding product at a glance.
  const widths = [300, 370, 330, 220, 350, 270];
  return h('div', { position: 'absolute', right: 64, top: 160, flexDirection: 'column', gap: 18, opacity: 0.16 },
    ...widths.map((width, index) => h('div', { gap: 12, alignItems: 'center' },
      h('div', { width: 26, fontSize: 18, color: MUTED }, String(index + 1)),
      h('div', { width, height: 14, borderRadius: 7, background: index % 3 === 0 ? AMBER : '#71717a' }),
    )),
  );
}

export function renderShareImage(run: SharedRun | null, host: string): ImageResponse {
  const card = run
    ? h('div', { flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '56px 64px' },
        h('div', { alignItems: 'center', gap: 20 },
          run.avatarUrl
            ? img(run.avatarUrl, { width: 76, height: 76, borderRadius: 38, border: `3px solid ${AMBER}` })
            : h('div', { width: 76, height: 76, borderRadius: 38, background: AMBER, color: '#18181b', fontSize: 40, alignItems: 'center', justifyContent: 'center' }, run.name.slice(0, 1).toUpperCase()),
          h('div', { flexDirection: 'column', gap: 4 },
            h('div', { fontSize: 36, color: INK }, run.name),
            h('div', { fontSize: 24, color: MUTED }, run.username ? `@${run.username}` : 'Codey typist'),
          ),
          run.verified
            ? h('div', { marginLeft: 16, padding: '8px 18px', borderRadius: 999, border: `2px solid ${AMBER}`, color: AMBER, fontSize: 22, alignItems: 'center', gap: 10 },
                // A drawn check: glyphs outside the bundled font would need a network font fetch.
                h('div', { width: 16, height: 9, borderLeft: `3px solid ${AMBER}`, borderBottom: `3px solid ${AMBER}`, transform: 'rotate(-45deg)', marginTop: -4 }),
                'Verified Ranked')
            : h('div', {}),
        ),
        h('div', { alignItems: 'flex-end', gap: 20 },
          h('div', { fontSize: 210, lineHeight: 0.9, color: INK, letterSpacing: -6 }, run.wpm.toFixed(1)),
          h('div', { fontSize: 48, color: AMBER, paddingBottom: 18 }, 'wpm'),
        ),
        h('div', { gap: 64, alignItems: 'flex-end' },
          stat('Accuracy', `${run.accuracy.toFixed(1)}%`),
          stat('Language', run.language),
          stat('Format', run.format),
        ),
      )
    : h('div', { flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: '56px 64px', gap: 24 },
        h('div', { fontSize: 96, color: INK, letterSpacing: -3 }, 'Type real code, faster.'),
        h('div', { fontSize: 36, color: MUTED }, 'Snippets from GitHub, daily challenges and live duels.'),
      );

  const root = h('div', { width: 1200, height: 630, position: 'relative', background: '#0f1117', fontFamily: 'Geist', overflow: 'hidden' },
    h('div', { position: 'absolute', left: -200, top: -260, width: 900, height: 900, borderRadius: 450, background: 'radial-gradient(circle, rgba(245,158,11,0.28), rgba(245,158,11,0) 65%)' }),
    codeLines(),
    card,
    h('div', { position: 'absolute', right: 64, bottom: 52, alignItems: 'center', gap: 14 },
      h('div', { width: 44, height: 44, borderRadius: 12, background: AMBER, color: '#18181b', fontSize: 26, alignItems: 'center', justifyContent: 'center' }, '</>'),
      h('div', { flexDirection: 'column' },
        h('div', { fontSize: 30, color: INK }, 'Codey'),
        h('div', { fontSize: 20, color: MUTED }, host),
      ),
    ),
    h('div', { position: 'absolute', left: 0, bottom: 0, width: 1200, height: 8, background: AMBER }),
  );

  return new ImageResponse(root as never, { width: 1200, height: 630 });
}
