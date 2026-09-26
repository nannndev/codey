import { ImageResponse } from '@vercel/og';
import type { SharedRun } from './share-card.js';

/**
 * 1200×630 preview card, drawn with Satori from plain element objects (no JSX
 * in the API folder). Split layout: the player and WPM on an amber panel, the
 * run's pace and numbers on the dark side.
 */

type Style = Record<string, string | number>;
interface Node { type: string; props: { style?: Style; children?: unknown; src?: string; width?: number; height?: number } }

const h = (type: string, style: Style, ...children: unknown[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const img = (src: string, style: Style): Node => ({ type: 'img', props: { src, style, width: Number(style.width), height: Number(style.height) } });

const AMBER = '#f59e0b';
const DEEP = '#78350f';
const DARK = '#0f1117';
const INK = '#f4f4f5';
const COAL = '#18181b';
const MUTED = '#a1a1aa';
const PANEL = 470;

/** Whole numbers read cleaner on a card: "120", but "88.4". */
export function formatWpm(wpm: number) {
  const rounded = Math.round(wpm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function stat(label: string, value: string, size = 38) {
  return h('div', { flexDirection: 'column', gap: 6 },
    h('div', { fontSize: 20, color: MUTED, letterSpacing: 2, textTransform: 'uppercase' }, label),
    h('div', { fontSize: size, color: INK }, value),
  );
}

function mark(background: string, color: string) {
  return h('div', { width: 44, height: 44, borderRadius: 12, background, color, fontSize: 26, alignItems: 'center', justifyContent: 'center' }, '</>');
}

function pill(text: string, color: string, check: boolean) {
  return h('div', { padding: '8px 18px', borderRadius: 999, border: `2px solid ${color}`, color, fontSize: 22, alignItems: 'center', gap: 10 },
    // A drawn check: glyphs outside the bundled font would need a network font fetch.
    check ? h('div', { width: 16, height: 9, borderLeft: `3px solid ${color}`, borderBottom: `3px solid ${color}`, transform: 'rotate(-45deg)', marginTop: -4 }) : h('div', {}),
    text);
}

/** Bars for the run's pace; the stretches above its own average are lit. */
function paceBars(trace: number[], width: number, height: number) {
  const max = Math.max(...trace);
  const floor = Math.max(0, Math.min(...trace) - (max - Math.min(...trace)) * 0.25 - 1);
  const average = trace.reduce((sum, value) => sum + value, 0) / trace.length;
  const gap = 8;
  const bar = (width - gap * (trace.length - 1)) / trace.length;
  return h('div', { width, height, alignItems: 'flex-end', gap },
    ...trace.map((value) => h('div', {
      width: bar,
      height: Math.max(8, ((value - floor) / Math.max(1, max - floor)) * height),
      borderRadius: 6,
      background: value >= average ? AMBER : 'rgba(255,255,255,0.07)',
    })),
  );
}

function wpmSize(text: string) {
  if (text.length <= 3) return 200;
  if (text.length === 4) return 150;
  return 128;
}

export function renderShareImage(run: SharedRun | null, host: string): ImageResponse {
  if (!run) {
    const root = h('div', { width: 1200, height: 630, background: DARK, fontFamily: 'Geist' },
      h('div', { width: PANEL, height: 630, background: AMBER, flexDirection: 'column', justifyContent: 'space-between', padding: '56px 52px' },
        h('div', {}),
        h('div', { fontSize: 150, lineHeight: 0.9, color: COAL, letterSpacing: -6 }, '</>'),
        h('div', { fontSize: 44, color: COAL }, 'Codey'),
      ),
      h('div', { flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '56px' },
        h('div', { justifyContent: 'flex-end', fontSize: 22, color: MUTED }, host),
        h('div', { flexDirection: 'column', gap: 22 },
          h('div', { fontSize: 76, color: INK, letterSpacing: -2, lineHeight: 1.05 }, 'Type real code, faster.'),
          h('div', { fontSize: 30, color: MUTED }, 'Snippets from GitHub, daily challenges and live duels.'),
        ),
        h('div', {}),
      ),
    );
    return new ImageResponse(root as never, { width: 1200, height: 630 });
  }

  const wpm = formatWpm(run.wpm);
  const where = run.language === 'Mixed' ? 'wpm across languages' : `wpm in ${run.language}`;
  const hasTrace = run.trace.length >= 3;

  const left = h('div', { width: PANEL, height: 630, background: AMBER, flexDirection: 'column', justifyContent: 'space-between', padding: '56px 52px' },
    h('div', { alignItems: 'center', gap: 16 },
      run.avatarUrl
        ? img(run.avatarUrl, { width: 70, height: 70, borderRadius: 35, border: `3px solid ${COAL}` })
        : h('div', { width: 70, height: 70, borderRadius: 35, background: COAL, color: AMBER, fontSize: 34, alignItems: 'center', justifyContent: 'center' }, run.name.slice(0, 1).toUpperCase()),
      h('div', { flexDirection: 'column', maxWidth: 280 },
        h('div', { fontSize: 32, color: COAL, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, run.name),
        h('div', { fontSize: 22, color: DEEP }, run.username ? `@${run.username}` : 'Codey typist'),
      ),
    ),
    h('div', { flexDirection: 'column' },
      h('div', { fontSize: wpmSize(wpm), lineHeight: 0.85, color: COAL, letterSpacing: -8 }, wpm),
      h('div', { fontSize: where.length >= 20 ? 30 : 40, color: DEEP, marginTop: 10 }, where),
    ),
    h('div', { alignItems: 'center', gap: 14 }, mark(COAL, AMBER), h('div', { fontSize: 28, color: COAL }, 'Codey')),
  );

  const middle = hasTrace
    ? h('div', { flexDirection: 'column', gap: 14 },
        h('div', { fontSize: 20, color: MUTED, letterSpacing: 2 }, 'SPEED THROUGH THE RUN'),
        paceBars(run.trace, 618, 170),
      )
    : h('div', { flexDirection: 'column', gap: 18 },
        h('div', { fontSize: 20, color: MUTED, letterSpacing: 2 }, 'RUN SUMMARY'),
        h('div', { gap: 72 },
          stat('Keystrokes', run.keystrokes.toLocaleString('en-US'), 64),
          stat('Mistakes', String(run.mistakes), 64),
        ),
      );

  const right = h('div', { flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '56px 56px' },
    h('div', { justifyContent: 'space-between', alignItems: 'center' },
      run.verified ? pill('Verified Ranked', AMBER, true) : pill('Practice run', MUTED, false),
      h('div', { fontSize: 22, color: MUTED }, host),
    ),
    middle,
    h('div', { gap: 56 },
      stat('Accuracy', `${run.accuracy.toFixed(1)}%`),
      stat('Format', run.format),
      stat('Raw speed', formatWpm(run.rawWpm)),
    ),
  );

  const root = h('div', { width: 1200, height: 630, background: DARK, fontFamily: 'Geist' }, left, right);
  return new ImageResponse(root as never, { width: 1200, height: 630 });
}
