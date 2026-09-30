import { APPWRITE, adminDatabases, applyCors, type ApiRequest, type ApiResponse } from '../appwrite-admin.js';
import { route } from '../route.js';
import { pushConfigured, removeSubscription, saveSubscription, sendStreakReminders, type SubscribeInput } from '../push.js';

const notReady = () => Object.assign(new Error('Push notifications are not set up on this server yet.'), { code: 503 });

/** GET /api/push/config: whether push works here, and the key browsers subscribe with. */
export const config = route('GET', { auth: 'none', label: 'Push' }, async () => ({ enabled: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));

/** POST /api/push/subscribe { endpoint, keys, streak, league, tzOffset } */
export const subscribe = route<SubscribeInput>('POST', { auth: 'required', label: 'Push' }, ({ db, user, body }) => {
  if (!pushConfigured()) throw notReady();
  return saveSubscription(db, user!.id, body);
});

/** POST /api/push/unsubscribe { endpoint } */
export const unsubscribe = route<{ endpoint: string }>('POST', { auth: 'required', label: 'Push' }, ({ db, user, body }) => removeSubscription(db, user!.id, String(body.endpoint ?? '')));

/**
 * GET /api/push/cron: the daily streak reminder, run by Vercel Cron. With
 * CRON_SECRET set, Vercel sends it as a bearer token and nobody else can run it.
 */
export async function cron(req: ApiRequest, res: ApiResponse) {
  applyCors(res, 'GET');
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization;
  if (!secret || (Array.isArray(header) ? header[0] : header) !== `Bearer ${secret}`) return void res.status(401).json({ error: 'Unauthorized.' });
  if (!pushConfigured() || !APPWRITE.apiKey) return void res.status(200).json({ sent: 0, skipped: 'push is not configured' });
  try {
    const db = adminDatabases();
    const sent = await sendStreakReminders(db as never, db as never);
    res.status(200).json({ sent });
  } catch (error) {
    console.error('Streak reminders failed:', error);
    res.status(500).json({ error: 'Streak reminders failed.' });
  }
}
