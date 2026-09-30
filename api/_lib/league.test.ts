import { describe, expect, it } from 'vitest';
import { FakeDb } from './fake-db';
import { awardRun, LEAGUE, loadPlayer, MAX_XP_PER_DAY, memberId, settle, weekEndsAt, weekKey, xpForRun, type LeagueDb } from './league';

const profile = (name: string) => ({ name, username: null, avatarUrl: null });
const NOW = new Date('2026-09-30T10:00:00Z');

function run(db: FakeDb, id: string, userId: string, correctChars = 300, accuracy = 97, createdAt = NOW) {
  db.put(LEAGUE.runs, { $id: id, userId, correctChars, accuracy, verified: false, $createdAt: createdAt.toISOString() });
}

describe('league rules', () => {
  it('names weeks by their Monday', () => {
    expect(weekKey(new Date('2026-09-30T10:00:00Z'))).toBe('2026-09-28');
    expect(weekKey(new Date('2026-09-28T00:00:00Z'))).toBe('2026-09-28');
    expect(weekKey(new Date('2026-10-04T23:59:59Z'))).toBe('2026-09-28');
    expect(weekEndsAt('2026-09-28')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('pays for careful characters', () => {
    expect(xpForRun({ correctChars: 10, accuracy: 100 })).toBe(0);
    expect(xpForRun({ correctChars: 300, accuracy: 97 })).toBe(30);
    expect(xpForRun({ correctChars: 300, accuracy: 85 })).toBe(15);
    expect(xpForRun({ correctChars: 300, accuracy: 97, verified: true })).toBe(45);
    expect(xpForRun({ correctChars: 5000, accuracy: 99 })).toBe(60);
  });

  it('promotes the top five and demotes the bottom five', () => {
    expect(settle(0, 1, 30)).toEqual({ division: 1, result: 'up' });
    expect(settle(3, 1, 30)).toEqual({ division: 3, result: 'stay' });
    expect(settle(2, 27, 30)).toEqual({ division: 1, result: 'down' });
    expect(settle(0, 30, 30)).toEqual({ division: 0, result: 'stay' });
    // Small groups: nobody drops.
    expect(settle(1, 8, 8)).toEqual({ division: 1, result: 'stay' });
  });
});

describe('earning XP', () => {
  it('joins a group on the first XP and counts each run once', async () => {
    const db = new FakeDb();
    run(db, 'r1', 'ana');
    const first = await awardRun(db as unknown as LeagueDb, 'ana', 'r1', profile('Ana'), NOW);
    expect(first).toMatchObject({ gained: 30, weekXp: 30, division: 0, groupId: '2026-09-28-0-1' });
    expect(await awardRun(db as unknown as LeagueDb, 'ana', 'r1', profile('Ana'), NOW)).toBeNull();
    expect(db.all(LEAGUE.members)).toHaveLength(1);
  });

  it('ignores other people\'s runs and old runs', async () => {
    const db = new FakeDb();
    run(db, 'r1', 'ana');
    run(db, 'r2', 'ana', 300, 97, new Date('2026-09-27T00:00:00Z'));
    expect(await awardRun(db as unknown as LeagueDb, 'bob', 'r1', profile('Bob'), NOW)).toBeNull();
    expect(await awardRun(db as unknown as LeagueDb, 'ana', 'r2', profile('Ana'), NOW)).toBeNull();
  });

  it('caps XP per day', async () => {
    const db = new FakeDb();
    for (let i = 0; i < 20; i += 1) run(db, `r${i}`, 'ana', 5000);
    let total = 0;
    for (let i = 0; i < 20; i += 1) total = (await awardRun(db as unknown as LeagueDb, 'ana', `r${i}`, profile('Ana'), NOW))?.weekXp ?? total;
    expect(total).toBe(MAX_XP_PER_DAY);
  });

  it('reports who was overtaken', async () => {
    const db = new FakeDb();
    run(db, 'a1', 'ana', 300);
    run(db, 'b1', 'bob', 100);
    run(db, 'b2', 'bob', 400);
    await awardRun(db as unknown as LeagueDb, 'ana', 'a1', profile('Ana'), NOW);
    await awardRun(db as unknown as LeagueDb, 'bob', 'b1', profile('Bob'), NOW);
    const pass = await awardRun(db as unknown as LeagueDb, 'bob', 'b2', profile('Bob'), NOW);
    expect(pass?.overtaken).toEqual(['ana']);
  });

  it('fills groups of 30 before opening another', async () => {
    const db = new FakeDb();
    for (let i = 0; i < 31; i += 1) {
      run(db, `r${i}`, `user${i}`);
      await awardRun(db as unknown as LeagueDb, `user${i}`, `r${i}`, profile(`U${i}`), NOW);
    }
    const groups = db.all(LEAGUE.groups).map((group) => [group.$id, group.size]);
    expect(groups).toEqual([['2026-09-28-0-1', 30], ['2026-09-28-0-2', 1]]);
  });
});

describe('settling a finished week', () => {
  it('moves players by their final rank the next time they are seen', async () => {
    const db = new FakeDb();
    const lastWeek = new Date('2026-09-23T10:00:00Z');
    for (let i = 0; i < 12; i += 1) {
      run(db, `r${i}`, `user${i}`, 100 + i * 40, 97, lastWeek);
      await awardRun(db as unknown as LeagueDb, `user${i}`, `r${i}`, profile(`U${i}`), lastWeek);
    }
    // user11 had the most XP; user0 the least.
    const top = await loadPlayer(db as unknown as LeagueDb, 'user11', '2026-09-28');
    expect(top).toMatchObject({ division: 1, lastResult: 'up', lastRank: 1, week: '', lastWeek: '2026-09-21' });
    const bottom = await loadPlayer(db as unknown as LeagueDb, 'user0', '2026-09-28');
    expect(bottom).toMatchObject({ division: 0, lastResult: 'stay', lastRank: 12 });
    expect(db.all(LEAGUE.members).find((doc) => doc.$id === memberId('2026-09-21', 'user11'))?.xp).toBe(54);
  });
});
