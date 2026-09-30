import { describe, expect, it } from 'vitest';
import { FakeDb } from './fake-db';
import { APPWRITE } from './appwrite-admin';
import { awardRun, LEAGUE } from './league';
import { feed, follow, followingIds, friendsBoard, leagueView, relation, search, unfollow, type SocialDb } from './social';

const NOW = new Date('2026-09-30T10:00:00Z');
const as = (db: FakeDb) => db as unknown as SocialDb;

function world() {
  const db = new FakeDb();
  for (const [id, name, username] of [['ana', 'Ana', 'ana-dev'], ['bob', 'Bob', 'bobby'], ['cy', 'Cy', 'cyrus']]) {
    db.put(APPWRITE.collections.profiles, { $id: id, displayName: name, githubUsername: username });
  }
  return db;
}

describe('follows', () => {
  it('follows once, unfollows, and never follows yourself', async () => {
    const db = world();
    await follow(as(db), 'ana', 'bob');
    await follow(as(db), 'ana', 'bob');
    await follow(as(db), 'ana', 'ana');
    expect(await followingIds(as(db), 'ana')).toEqual(['bob']);
    expect(await relation(as(db), 'ana', 'bob')).toEqual({ followers: 1, following: 0, isFollowing: true });
    await unfollow(as(db), 'ana', 'bob');
    expect(await relation(as(db), 'ana', 'bob')).toEqual({ followers: 0, following: 0, isFollowing: false });
  });

  it('finds players by GitHub username or name', async () => {
    const db = world();
    await follow(as(db), 'ana', 'bob');
    const { results } = await search(as(db), 'ana', '@bo');
    expect(results.map((r) => [r.userId, r.isFollowing])).toEqual([['bob', true]]);
    expect((await search(as(db), 'ana', 'a')).results).toEqual([]);
  });
});

describe('friends board and feed', () => {
  it('ranks you and the people you follow by weekly XP, with best speed', async () => {
    const db = world();
    await follow(as(db), 'ana', 'bob');
    db.put(LEAGUE.runs, { $id: 'b1', userId: 'bob', correctChars: 500, accuracy: 98, wpm: 91, language: 'Go', $createdAt: NOW.toISOString() });
    db.put(LEAGUE.runs, { $id: 'a1', userId: 'ana', correctChars: 200, accuracy: 98, wpm: 70, language: 'TypeScript', $createdAt: NOW.toISOString() });
    await awardRun(as(db), 'bob', 'b1', { name: 'Bob', username: 'bobby', avatarUrl: null }, NOW);
    await awardRun(as(db), 'ana', 'a1', { name: 'Ana', username: 'ana-dev', avatarUrl: null }, NOW);
    const board = await friendsBoard(as(db), 'ana', NOW);
    expect(board.rows.map((row) => [row.userId, row.xp, row.bestWpm, row.you])).toEqual([['bob', 50, 91, false], ['ana', 20, 70, true]]);

    const { items } = await feed(as(db), 'ana');
    expect(items.map((item) => [item.player.name, item.wpm, item.language])).toEqual([['Bob', 91, 'Go']]);
  });

  it('shows the league once you have XP this week', async () => {
    const db = world();
    expect((await leagueView(as(db), 'ana', NOW)).joined).toBe(false);
    db.put(LEAGUE.runs, { $id: 'a1', userId: 'ana', correctChars: 200, accuracy: 98, wpm: 70, $createdAt: NOW.toISOString() });
    await awardRun(as(db), 'ana', 'a1', { name: 'Ana', username: null, avatarUrl: null }, NOW);
    const view = await leagueView(as(db), 'ana', NOW);
    expect(view).toMatchObject({ joined: true, divisionName: 'Bronze', week: '2026-09-28', rules: { promote: 5, demote: 0 } });
    expect(view.standings).toEqual([{ rank: 1, userId: 'ana', name: 'Ana', username: null, avatarUrl: null, xp: 20 }]);
  });
});
