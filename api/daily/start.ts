import crypto from 'node:crypto';
import { Permission, Role } from 'node-appwrite';
import { APPWRITE, adminDatabases, applyCors, authenticateRequest, isConfigured, type ApiRequest, type ApiResponse } from '../_lib/appwrite-admin.js';
import { getOrCreateChallenge, sessionChallengeHash, utcDateKey, type DailyDb } from '../_lib/daily.js';

const RUN_WINDOW_MS = 20 * 60 * 1000;

/** POST /api/daily/start: opens a verified attempt at today's challenge. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, 'POST');
  if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed.' });
  if (!isConfigured()) return void res.status(503).json({ error: 'Daily challenge service is not configured.' });

  const userId = await authenticateRequest(req.headers);
  if (!userId) return void res.status(401).json({ error: 'Sign in with GitHub to post a daily score.' });

  const today = utcDateKey();
  const db = adminDatabases() as unknown as DailyDb;
  try {
    const challenge = await getOrCreateChallenge(db, today);
    const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const expiresAt = new Date(Date.now() + RUN_WINDOW_MS).toISOString();
    await db.createDocument({
      databaseId: APPWRITE.databaseId,
      collectionId: APPWRITE.collections.runSessions,
      documentId: sessionId,
      data: {
        userId,
        challenge: sessionChallengeHash(today, userId, sessionId),
        mode: 'snippet',
        language: challenge.language,
        expiresAt,
      },
      permissions: [Permission.read(Role.user(userId))],
    });
    res.status(200).json({ sessionId, date: today, expiresAt });
  } catch (error) {
    console.error('Daily start failed:', error);
    res.status(503).json({ error: 'Daily attempt could not be started. Try again shortly.' });
  }
}
