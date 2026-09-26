import { adminDatabases, applyCors, authenticateUser, isConfigured, readBody, type ApiRequest, type ApiResponse } from '../_lib/appwrite-admin.js';
import { listOpenRooms, parseListing, publishRoom, unpublishRoom, type DuelDb } from '../_lib/duel-rooms.js';

/**
 * GET    /api/duel/rooms            open public rooms
 * POST   /api/duel/rooms            create or refresh the caller's listing (signed in)
 * DELETE /api/duel/rooms?code=...   remove the caller's listing (signed in)
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, 'GET, POST, DELETE');
  if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
  if (!isConfigured()) return void res.status(503).json({ error: 'Public rooms are not configured.' });

  const db = adminDatabases() as unknown as DuelDb;
  try {
    if (!req.method || req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return void res.status(200).json({ rooms: await listOpenRooms(db) });
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') return void res.status(405).json({ error: 'Method not allowed.' });
    const user = await authenticateUser(req.headers);
    if (!user) return void res.status(401).json({ error: 'Sign in with GitHub to host a public room.' });

    if (req.method === 'DELETE') {
      const raw = req.query.code;
      const result = await unpublishRoom(db, user.id, String(Array.isArray(raw) ? raw[0] : raw ?? ''));
      return void ('error' in result ? res.status(result.status).json({ error: result.error }) : res.status(200).json(result));
    }

    const parsed = parseListing(readBody<Record<string, unknown>>(req), user);
    if ('error' in parsed) return void res.status(400).json({ error: parsed.error });
    const result = await publishRoom(db, parsed.listing);
    return void ('error' in result ? res.status(result.status).json({ error: result.error }) : res.status(200).json(result));
  } catch (error) {
    console.error('Duel rooms failed:', error);
    res.status(503).json({ error: 'Public rooms are unavailable right now.' });
  }
}
