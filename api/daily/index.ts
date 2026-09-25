import { Query } from 'node-appwrite';
import { APPWRITE, adminDatabases, applyCors, isConfigured, type ApiRequest, type ApiResponse } from '../_lib/appwrite-admin.js';
import { getOrCreateChallenge, listBoard, nextResetAt, userStreaks, utcDateKey, type DailyDb } from '../_lib/daily.js';

/**
 * GET /api/daily?userId=...
 * Today's frozen challenge, the day's board (best run per player) with
 * profiles, and the requesting player's streak and standing when userId is given.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, 'GET');
  if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
  if (req.method && req.method !== 'GET') return void res.status(405).json({ error: 'Method not allowed.' });
  if (!isConfigured()) return void res.status(503).json({ error: 'Daily challenge service is not configured.' });

  const rawUser = req.query.userId;
  const userId = Array.isArray(rawUser) ? rawUser[0] : rawUser;
  const today = utcDateKey();
  const db = adminDatabases() as unknown as DailyDb;

  let challenge;
  try {
    challenge = await getOrCreateChallenge(db, today);
  } catch (error) {
    console.error('Daily challenge unavailable:', error);
    return void res.status(503).json({ error: "Today's challenge is still being picked from GitHub. Try again in a minute." });
  }

  try {
    const runs = await listBoard(db, today);
    const ids = [...new Set(runs.map((run) => run.userId))];
    const profiles = ids.length
      ? (await db.listDocuments({
          databaseId: APPWRITE.databaseId,
          collectionId: APPWRITE.collections.profiles,
          queries: [Query.equal('$id', ids), Query.limit(ids.length)],
        })).documents
      : [];
    const me = userId ? await userStreaks(db, userId, today) : null;

    // Short shared cache when anonymous; personalised responses are not shared.
    res.setHeader('Cache-Control', userId ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=120');
    res.status(200).json({ date: today, nextResetAt: nextResetAt(), challenge, runs, profiles, streak: me });
  } catch (error) {
    console.error('Daily board failed:', error);
    res.status(503).json({ error: 'Daily leaderboard could not be loaded.' });
  }
}
