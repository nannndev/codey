import { APPWRITE, adminDatabases, applyCors, authenticateRequest, isConfigured, readBody, type ApiRequest, type ApiResponse } from '../_lib/appwrite-admin.js';
import {
  findChallenge,
  isDateKey,
  rankOf,
  recordBest,
  scoreRun,
  sessionChallengeHash,
  userStreaks,
  utcDateKey,
  type DailyDb,
  type SubmittedMetrics,
} from '../_lib/daily.js';

interface SubmitBody extends SubmittedMetrics {
  sessionId: string;
  date: string;
}

/** POST /api/daily/submit: verifies an attempt and keeps the player's best of the day. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, 'POST');
  if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed.' });
  if (!isConfigured()) return void res.status(503).json({ error: 'Daily challenge service is not configured.' });

  const userId = await authenticateRequest(req.headers);
  if (!userId) return void res.status(401).json({ error: 'Sign in with GitHub to post a daily score.' });

  const body = readBody<SubmitBody>(req);
  if (!body.sessionId || !isDateKey(body.date) || typeof body.completedCode !== 'string') {
    return void res.status(400).json({ error: 'Invalid daily submission.' });
  }

  const db = adminDatabases() as unknown as DailyDb;
  const sessionRef = { databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.runSessions, documentId: body.sessionId };

  let session: Record<string, unknown>;
  try {
    session = await db.getDocument(sessionRef);
  } catch {
    return void res.status(400).json({ error: 'Daily attempt was not found.' });
  }
  if (session.userId !== userId) return void res.status(403).json({ error: 'This attempt belongs to another player.' });
  if (session.completedAt) return void res.status(409).json({ error: 'This attempt was already submitted.' });
  if (new Date(String(session.expiresAt)).getTime() < Date.now()) return void res.status(410).json({ error: 'This attempt expired.' });
  if (session.challenge !== sessionChallengeHash(body.date, userId, body.sessionId)) {
    return void res.status(400).json({ error: 'Attempt does not belong to this daily challenge.' });
  }
  // A run started just before midnight may finish just after; older days are closed.
  const today = utcDateKey();
  const yesterday = utcDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (body.date !== today && body.date !== yesterday) return void res.status(410).json({ error: 'That daily challenge is closed.' });

  const challenge = await findChallenge(db, body.date);
  if (!challenge) return void res.status(404).json({ error: 'Daily challenge not found.' });

  const scored = scoreRun(challenge.code, body as SubmittedMetrics);
  // Close the session either way so a rejected attempt cannot be replayed.
  await db.updateDocument({ ...sessionRef, data: { completedAt: new Date().toISOString() } }).catch(() => undefined);
  if ('error' in scored) return void res.status(400).json({ error: scored.error });

  try {
    const { best, improved } = await recordBest(db, body.date, userId, challenge.language, {
      wpm: scored.wpm,
      rawWpm: scored.rawWpm,
      accuracy: scored.accuracy,
      keystrokes: scored.keystrokes,
      mistakes: Math.max(0, Math.round(Number(body.mistakes) || 0)),
      durationMs: Math.round(Number(body.totalMs) || 0),
    });
    const [rank, streak] = await Promise.all([rankOf(db, body.date, best.wpm), userStreaks(db, userId, today)]);
    res.status(200).json({
      verified: true,
      wpm: scored.wpm,
      accuracy: scored.accuracy,
      improved,
      best: { wpm: best.wpm, accuracy: best.accuracy, attempts: best.attempts },
      rank,
      streak,
    });
  } catch (error) {
    console.error('Daily submit failed:', error);
    res.status(503).json({ error: 'Daily score could not be saved.' });
  }
}
