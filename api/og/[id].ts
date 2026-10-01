import { isConfigured, type ApiRequest } from '../_lib/appwrite-admin.js';
import { loadSharedRun } from '../_lib/share-card.js';
import { renderChallengeImage, renderProfileImage, renderShareImage } from '../_lib/og-image.js';
import { loadChallenge } from '../_lib/challenge-card.js';
import { loadSharedProfile } from '../_lib/profile-card.js';
import { playerKap, playerLook } from '../_lib/kap-look.js';
import { badgeStyle, badgeTheme, renderBadge } from '../_lib/badge.js';

interface BinaryResponse {
  status: (code: number) => BinaryResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: Buffer | string) => void;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/**
 * GET /api/og/<runId>: the PNG preview for a shared run; runs never change, so it caches hard.
 * GET /api/og/<userId>?kind=profile: a player's card, cached briefly since it moves with each run.
 * GET /api/og/<challengeId>?kind=challenge: the score to beat and the snippet.
 * GET /api/og/<userId>?kind=badge&style=card|flat&theme=dark|light: an SVG README badge (also /b/<userId>).
 */
export default async function handler(req: ApiRequest, res: BinaryResponse) {
  const id = first(req.query.id).replace(/\.png$/, '');
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || 'codey';
  if (first(req.query.kind) === 'challenge') {
    const challenge = isConfigured() ? await loadChallenge(id) : null;
    const image = challenge ? renderChallengeImage(challenge, host, await playerKap(challenge.userId)) : renderShareImage(null, host);
    const body = Buffer.from(await image.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    // Challenges never change once created.
    res.setHeader('Cache-Control', challenge ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=300');
    res.status(200).end(body);
    return;
  }
  if (first(req.query.kind) === 'badge') {
    const profile = isConfigured() ? await loadSharedProfile(id.replace(/\.svg$/, '')) : null;
    const style = badgeStyle(first(req.query.style));
    const kap = profile && style === 'card' ? await playerLook(profile.userId, profile.bestStreak) : null;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    // GitHub's image proxy honours this, so a badge catches up within the hour.
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400');
    res.status(200).end(renderBadge({ profile, kap, style, theme: badgeTheme(first(req.query.theme)) }));
    return;
  }
  if (first(req.query.kind) === 'profile') {
    const profile = isConfigured() ? await loadSharedProfile(id) : null;
    const image = profile ? renderProfileImage(profile, host, await playerKap(profile.userId, profile.bestStreak)) : renderShareImage(null, host);
    const body = Buffer.from(await image.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', profile ? 'public, max-age=300, s-maxage=600' : 'public, max-age=300');
    res.status(200).end(body);
    return;
  }
  const run = isConfigured() ? await loadSharedRun(id) : null;
  const image = renderShareImage(run, host, run ? await playerKap(run.userId) : undefined);
  const body = Buffer.from(await image.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', run ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=300');
  res.status(200).end(body);
}
