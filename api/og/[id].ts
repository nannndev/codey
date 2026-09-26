import { isConfigured, type ApiRequest } from '../_lib/appwrite-admin.js';
import { loadSharedRun } from '../_lib/share-card.js';
import { renderChallengeImage, renderProfileImage, renderShareImage } from '../_lib/og-image.js';
import { loadChallenge } from '../_lib/challenge-card.js';
import { loadSharedProfile } from '../_lib/profile-card.js';

interface BinaryResponse {
  status: (code: number) => BinaryResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: Buffer) => void;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/**
 * GET /api/og/<runId>: the PNG preview for a shared run; runs never change, so it caches hard.
 * GET /api/og/<userId>?kind=profile: a player's card, cached briefly since it moves with each run.
 * GET /api/og/<challengeId>?kind=challenge: the score to beat and the snippet.
 */
export default async function handler(req: ApiRequest, res: BinaryResponse) {
  const id = first(req.query.id).replace(/\.png$/, '');
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || 'codey';
  if (first(req.query.kind) === 'challenge') {
    const challenge = isConfigured() ? await loadChallenge(id) : null;
    const image = challenge ? renderChallengeImage(challenge, host) : renderShareImage(null, host);
    const body = Buffer.from(await image.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    // Challenges never change once created.
    res.setHeader('Cache-Control', challenge ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=300');
    res.status(200).end(body);
    return;
  }
  if (first(req.query.kind) === 'profile') {
    const profile = isConfigured() ? await loadSharedProfile(id) : null;
    const image = profile ? renderProfileImage(profile, host) : renderShareImage(null, host);
    const body = Buffer.from(await image.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', profile ? 'public, max-age=300, s-maxage=600' : 'public, max-age=300');
    res.status(200).end(body);
    return;
  }
  const run = isConfigured() ? await loadSharedRun(id) : null;
  const image = renderShareImage(run, host);
  const body = Buffer.from(await image.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', run ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=300');
  res.status(200).end(body);
}
