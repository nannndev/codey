import crypto from 'node:crypto';
import webpush from 'web-push';
import { Query } from 'node-appwrite';
import { APPWRITE } from './appwrite-admin.js';
import { DIVISIONS } from './league.js';

/**
 * Web Push: subscriptions per device, a daily streak reminder (Vercel cron)
 * and a nudge when someone overtakes you in your league. Needs VAPID keys:
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on the server, VITE_VAPID_PUBLIC_KEY
 * for the app, and VAPID_SUBJECT (a mailto: or https: contact).
 */

export const PUSH_SUBSCRIPTIONS = process.env.VITE_APPWRITE_PUSH_COLLECTION_ID || 'push_subscriptions';

type Doc = Record<string, unknown> & { $id: string };
export interface PushDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
  createDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown> }): Promise<Doc>;
  updateDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown> }): Promise<Doc>;
  deleteDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<unknown>;
  listDocuments(params: { databaseId: string; collectionId: string; queries: string[] }): Promise<{ documents: Doc[]; total?: number }>;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type Sender = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;

const db = () => ({ databaseId: APPWRITE.databaseId, collectionId: PUSH_SUBSCRIPTIONS });
const isCode = (error: unknown, code: number) => (error as { code?: number } | null)?.code === code;

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
/** Sends through web-push with our VAPID keys. */
export const webPushSender: Sender = (subscription, payload) => {
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@codey.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 12 });
};

export const subscriptionId = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export interface SubscribeInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  streak?: unknown;
  league?: unknown;
  tzOffset?: unknown;
}

/** Stores (or updates) this device's subscription and what it wants to hear about. */
export async function saveSubscription(database: PushDb, userId: string, input: SubscribeInput) {
  const endpoint = typeof input.endpoint === 'string' ? input.endpoint : '';
  const p256dh = typeof input.keys?.p256dh === 'string' ? input.keys.p256dh : '';
  const auth = typeof input.keys?.auth === 'string' ? input.keys.auth : '';
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
    throw Object.assign(new Error('That push subscription is not valid.'), { code: 400 });
  }
  const tz = Math.max(-840, Math.min(840, Math.round(Number(input.tzOffset) || 0)));
  const data = { userId, endpoint, p256dh, auth, streak: input.streak !== false, league: input.league !== false, tzOffset: tz };
  const id = subscriptionId(endpoint);
  try {
    await database.createDocument({ ...db(), documentId: id, data });
  } catch (error) {
    if (!isCode(error, 409)) throw error;
    await database.updateDocument({ ...db(), documentId: id, data });
  }
  return { ok: true, streak: data.streak, league: data.league };
}

export async function removeSubscription(database: PushDb, userId: string, endpoint: string) {
  const id = subscriptionId(endpoint);
  try {
    const doc = await database.getDocument({ ...db(), documentId: id });
    if (doc.userId === userId) await database.deleteDocument({ ...db(), documentId: id });
  } catch (error) {
    if (!isCode(error, 404)) throw error;
  }
  return { ok: true };
}

async function deliver(database: PushDb, subscription: Doc, message: PushMessage, send: Sender) {
  try {
    await send({ endpoint: String(subscription.endpoint), keys: { p256dh: String(subscription.p256dh), auth: String(subscription.auth) } }, JSON.stringify(message));
    return true;
  } catch (error) {
    // The browser dropped the subscription: forget it.
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await database.deleteDocument({ ...db(), documentId: subscription.$id }).catch(() => undefined);
    return false;
  }
}

/** Pushes to every device of these players that opted in to this kind of message. */
export async function notifyUsers(database: PushDb, userIds: string[], kind: 'streak' | 'league', message: PushMessage, send: Sender = webPushSender) {
  if (!userIds.length || (send === webPushSender && !pushConfigured())) return 0;
  const { documents } = await database.listDocuments({ ...db(), queries: [Query.equal('userId', userIds.slice(0, 100)), Query.equal(kind, true), Query.limit(200)] });
  const sent = await Promise.all(documents.map((subscription) => deliver(database, subscription, message, send)));
  return sent.filter(Boolean).length;
}

export function overtakeMessage(name: string, division: number): PushMessage {
  return {
    title: `${name} just passed you`,
    body: `You slipped a place in the ${DIVISIONS[division] ?? 'Bronze'} league. One run gets it back.`,
    url: '/league',
    tag: 'codey-league',
  };
}

/* ---- Daily streak reminder ---- */

const localDate = (at: Date, offsetMinutes: number) => new Date(at.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);

/** Whether a player's streak is still open today (practiced yesterday, not yet today) in their time zone. */
export function streakAtRisk(profile: Record<string, unknown>, tzOffset: number, now = new Date()): number {
  const streak = Number(profile.currentStreak) || 0;
  const last = typeof profile.lastActiveDate === 'string' ? profile.lastActiveDate : '';
  if (streak < 1 || !last) return 0;
  const lastDay = localDate(new Date(last), tzOffset);
  const today = localDate(now, tzOffset);
  const yesterday = localDate(new Date(now.getTime() - 86_400_000), tzOffset);
  if (lastDay === today) return 0;
  return lastDay === yesterday ? streak : 0;
}

export function streakMessage(days: number): PushMessage {
  return {
    title: days >= 7 ? `Kap's ${days}-day flame is fading` : `Keep your ${days}-day streak`,
    body: 'One quick run keeps it alive. Kap is waiting.',
    url: '/',
    tag: 'codey-streak',
  };
}

/** The daily cron: remind every opted-in player whose streak would break at midnight. */
export async function sendStreakReminders(database: PushDb, profilesDb: PushDb, now = new Date(), send: Sender = webPushSender) {
  let cursor = '';
  let sent = 0;
  for (let page = 0; page < 20; page += 1) {
    const queries = [Query.equal('streak', true), Query.orderAsc('$id'), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { documents } = await database.listDocuments({ ...db(), queries });
    if (!documents.length) break;
    cursor = documents[documents.length - 1].$id;
    const ids = [...new Set(documents.map((doc) => String(doc.userId)))];
    const { documents: profiles } = await profilesDb.listDocuments({ databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.profiles, queries: [Query.equal('$id', ids), Query.limit(ids.length)] });
    const byId = new Map(profiles.map((profile) => [profile.$id, profile]));
    for (const subscription of documents) {
      const profile = byId.get(String(subscription.userId));
      const days = profile ? streakAtRisk(profile, Number(subscription.tzOffset) || 0, now) : 0;
      if (days && (await deliver(database, subscription, streakMessage(days), send))) sent += 1;
    }
    if (documents.length < 100) break;
  }
  return sent;
}
