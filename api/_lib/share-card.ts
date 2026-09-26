import { APPWRITE, adminDatabases } from './appwrite-admin.js';

/**
 * Public share links for a run: /r/<runId> serves Open Graph tags so Threads,
 * X, Facebook, LinkedIn, WhatsApp and friends show a rich preview, and
 * /api/og/<runId> renders that preview from the stored run, so the numbers on
 * the card always match the database.
 */

export const RUN_ID_PATTERN = /^[A-Za-z0-9_]{1,36}$/;

export interface SharedRun {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  language: string;
  mode: string;
  format: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  verified: boolean;
  createdAt: string;
}

type Doc = Record<string, unknown>;

interface ShareDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
}

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);

export function formatLabel(run: Doc): string {
  if (run.mode === 'timed') return `${Number(run.durationSeconds) || Math.round(Number(run.durationMs) / 1000)}s timed`;
  if (run.mode === 'zen') return 'zen';
  return `${text(run.snippetLength, 10) || 'medium'} snippet`;
}

export async function loadSharedRun(id: string, db: ShareDb = adminDatabases() as unknown as ShareDb): Promise<SharedRun | null> {
  if (!RUN_ID_PATTERN.test(id)) return null;
  let run: Doc;
  try {
    run = await db.getDocument({ databaseId: APPWRITE.databaseId, collectionId: process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || 'runs', documentId: id });
  } catch {
    return null;
  }
  const userId = text(run.userId, 36);
  let profile: Doc = {};
  try {
    profile = await db.getDocument({ databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.profiles, documentId: userId });
  } catch {
    // A run without a profile still shares, just without a name.
  }
  const username = text(profile.githubUsername, 100) || null;
  return {
    id,
    userId,
    name: text(profile.displayName, 60) || username || 'A Codey typist',
    username,
    avatarUrl: typeof profile.avatarUrl === 'string' && profile.avatarUrl.startsWith('https://') ? profile.avatarUrl : username ? `https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=200` : null,
    language: text(run.language, 40) || 'Code',
    mode: text(run.mode, 10),
    format: formatLabel(run),
    wpm: Number(run.wpm) || 0,
    accuracy: Number(run.accuracy) || 0,
    consistency: Number(run.consistency) || 0,
    verified: run.verified === true,
    createdAt: text(run.$createdAt, 40),
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function shareTitle(run: SharedRun) {
  return `${run.name} typed ${run.wpm.toFixed(1)} WPM in ${run.language}`;
}

export function shareDescription(run: SharedRun) {
  return `${run.accuracy.toFixed(1)}% accuracy · ${run.format}${run.verified ? ' · verified Ranked run' : ''}. Practice typing real code on Codey.`;
}

/** The page crawlers read. People are sent on to the player's profile. */
export function shareHtml(run: SharedRun | null, origin: string, id: string) {
  const target = run ? `${origin}/profile/${encodeURIComponent(run.userId)}` : origin;
  const title = run ? shareTitle(run) : 'Codey: type real code, faster';
  const description = run ? shareDescription(run) : 'Typing practice with real code from GitHub, daily challenges and live duels.';
  const image = run ? `${origin}/api/og/${encodeURIComponent(id)}` : `${origin}/og-default.png`;
  const url = `${origin}/r/${encodeURIComponent(id)}`;
  const meta = (property: string, content: string, attr = 'property') => `<meta ${attr}="${property}" content="${escapeHtml(content)}">`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${meta('description', description, 'name')}
${meta('og:type', 'website')}
${meta('og:site_name', 'Codey')}
${meta('og:title', title)}
${meta('og:description', description)}
${meta('og:url', url)}
${meta('og:image', image)}
${meta('og:image:width', '1200')}
${meta('og:image:height', '630')}
${meta('og:image:alt', title)}
${meta('twitter:card', 'summary_large_image', 'name')}
${meta('twitter:title', title, 'name')}
${meta('twitter:description', description, 'name')}
${meta('twitter:image', image, 'name')}
<link rel="canonical" href="${escapeHtml(url)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head><body style="font-family:system-ui;background:#0f1117;color:#e5e7eb;display:grid;place-items:center;min-height:100vh">
<p>Opening <a style="color:#fbbf24" href="${escapeHtml(target)}">${escapeHtml(title)}</a>…</p>
<script>location.replace(${JSON.stringify(target)})</script>
</body></html>`;
}
