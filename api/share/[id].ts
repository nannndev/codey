import { isConfigured, type ApiRequest } from '../_lib/appwrite-admin.js';
import { loadSharedRun, shareHtml } from '../_lib/share-card.js';
import { loadSharedProfile, profileShareHtml } from '../_lib/profile-card.js';
import { challengeShareHtml, loadChallenge } from '../_lib/challenge-card.js';

interface HtmlResponse {
  status: (code: number) => HtmlResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** GET /r/<runId>, /p/<userId> and /c/<challengeId> (rewritten here): Open Graph tags for crawlers, a redirect for people. */
export default async function handler(req: ApiRequest, res: HtmlResponse) {
  const id = first(req.query.id);
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host);
  const proto = first(req.headers['x-forwarded-proto']) || 'https';
  const origin = host ? `${proto}://${host}` : '';
  const configured = isConfigured();
  let found: boolean;
  let html: string;
  const kind = first(req.query.kind);
  if (kind === 'challenge') {
    const challenge = configured ? await loadChallenge(id) : null;
    found = Boolean(challenge);
    html = challengeShareHtml(challenge, origin, id);
  } else if (kind === 'profile') {
    const profile = configured ? await loadSharedProfile(id) : null;
    found = Boolean(profile);
    html = profileShareHtml(profile, origin, id);
  } else {
    const run = configured ? await loadSharedRun(id) : null;
    found = Boolean(run);
    html = shareHtml(run, origin, id);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Profiles change with every run, so they cache briefly.
  res.setHeader('Cache-Control', found ? 'public, max-age=300, s-maxage=600' : 'public, max-age=60');
  // Always 200: crawlers drop previews for error pages, and the fallback is a valid site card.
  res.status(200).end(html);
}
