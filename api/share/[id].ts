import { isConfigured, type ApiRequest } from '../_lib/appwrite-admin.js';
import { loadSharedRun, shareHtml } from '../_lib/share-card.js';

interface HtmlResponse {
  status: (code: number) => HtmlResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** GET /r/<runId> (rewritten here): Open Graph tags for crawlers, a redirect for people. */
export default async function handler(req: ApiRequest, res: HtmlResponse) {
  const id = first(req.query.id);
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host);
  const proto = first(req.headers['x-forwarded-proto']) || 'https';
  const origin = host ? `${proto}://${host}` : '';
  const run = isConfigured() ? await loadSharedRun(id) : null;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', run ? 'public, max-age=300, s-maxage=86400' : 'public, max-age=60');
  res.status(run ? 200 : 404).end(shareHtml(run, origin, id));
}
