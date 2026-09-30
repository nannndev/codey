import { describe, expect, it, vi } from 'vitest';
import { FakeDb } from './fake-db';
import { APPWRITE } from './appwrite-admin';
import { notifyUsers, PUSH_SUBSCRIPTIONS, saveSubscription, sendStreakReminders, streakAtRisk, type PushDb, type Sender } from './push';

const as = (db: FakeDb) => db as unknown as PushDb;
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

describe('push subscriptions', () => {
  it('stores one subscription per device and validates it', async () => {
    const db = new FakeDb();
    await saveSubscription(as(db), 'ana', { ...sub(1), tzOffset: 420 });
    await saveSubscription(as(db), 'ana', { ...sub(1), league: false });
    expect(db.all(PUSH_SUBSCRIPTIONS)).toHaveLength(1);
    expect(db.all(PUSH_SUBSCRIPTIONS)[0]).toMatchObject({ league: false, streak: true, tzOffset: 0 });
    await expect(saveSubscription(as(db), 'ana', { endpoint: 'http://nope', keys: { p256dh: 'p', auth: 'a' } })).rejects.toMatchObject({ code: 400 });
  });

  it('only notifies devices that opted in, and forgets dead ones', async () => {
    const db = new FakeDb();
    await saveSubscription(as(db), 'ana', { ...sub(1) });
    await saveSubscription(as(db), 'ana', { ...sub(2), league: false });
    await saveSubscription(as(db), 'bob', { ...sub(3) });
    const send = vi.fn<Sender>(async (subscription) => {
      if (subscription.endpoint.endsWith('/3')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    const sent = await notifyUsers(as(db), ['ana', 'bob'], 'league', { title: 't', body: 'b', url: '/', tag: 'x' }, send);
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(db.all(PUSH_SUBSCRIPTIONS).map((doc) => doc.userId)).toEqual(['ana', 'ana']);
  });
});

describe('streak reminders', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('reminds only streaks that break tonight, in the player\'s time zone', () => {
    expect(streakAtRisk({ currentStreak: 5, lastActiveDate: '2026-09-29T15:00:00Z' }, 0, now)).toBe(5);
    expect(streakAtRisk({ currentStreak: 5, lastActiveDate: '2026-09-30T01:00:00Z' }, 0, now)).toBe(0);
    expect(streakAtRisk({ currentStreak: 5, lastActiveDate: '2026-09-27T15:00:00Z' }, 0, now)).toBe(0);
    // 19:00 in Jakarta on the 30th; they last practised at 06:00 there on the 30th.
    expect(streakAtRisk({ currentStreak: 5, lastActiveDate: '2026-09-29T23:00:00Z' }, 420, now)).toBe(0);
    expect(streakAtRisk({ currentStreak: 0, lastActiveDate: '2026-09-29T15:00:00Z' }, 0, now)).toBe(0);
  });

  it('sends the cron reminder to players at risk', async () => {
    const db = new FakeDb();
    db.put(APPWRITE.collections.profiles, { $id: 'ana', currentStreak: 9, lastActiveDate: '2026-09-29T10:00:00Z' });
    db.put(APPWRITE.collections.profiles, { $id: 'bob', currentStreak: 3, lastActiveDate: '2026-09-30T08:00:00Z' });
    await saveSubscription(as(db), 'ana', { ...sub(1) });
    await saveSubscription(as(db), 'bob', { ...sub(2) });
    const send = vi.fn<Sender>(async () => undefined);
    expect(await sendStreakReminders(as(db), as(db), now, send)).toBe(1);
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({ title: "Kap's 9-day flame is fading", url: '/' });
  });
});
