import { isConfigured, type ApiRequest } from '../_lib/appwrite-admin.js';
import { loadSharedRun } from '../_lib/share-card.js';
import { renderShareImage } from '../_lib/og-image.js';

interface BinaryResponse {
  status: (code: number) => BinaryResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: Buffer) => void;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** GET /api/og/<runId>: the PNG preview for a shared run. Runs never change, so it caches hard. */
export default async function handler(req: ApiRequest, res: BinaryResponse) {
  const id = first(req.query.id).replace(/\.png$/, '');
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || 'codey';
  const run = isConfigured() ? await loadSharedRun(id) : null;
  const image = renderShareImage(run, host);
  const body = Buffer.from(await image.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', run ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=300');
  res.status(200).end(body);
}
