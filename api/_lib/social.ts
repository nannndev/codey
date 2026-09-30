import crypto from 'node:crypto';
import { Query } from 'node-appwrite';
import { APPWRITE } from './appwrite-admin.js';
import { runKind } from '../../src/utils/ranking.js';
import { DEMOTE, DIVISIONS, GROUP_SIZE, LEAGUE, listGroup, loadPlayer, memberId, MIN_SIZE_TO_DEMOTE, PROMOTE, TOP_DIVISION, weekEndsAt, weekKey, type LeagueDb, type MemberProfile } from './league.js';

/**
 * Friends: one-way follows (like GitHub), a board of the people you follow by
 * this week's league XP and best speed, and a feed of their recent runs.
 */

export const FOLLOWS = process.env.VITE_APPWRITE_FOLLOWS_COLLECTION_ID || 'follows';
const MAX_FOLLOWING = 200;

type Doc = Record<string, unknown> & { $id: string };
export interface SocialDb extends LeagueDb {
  deleteDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<unknown>;
}

const db = (collectionId: string) => ({ databaseId: APPWRITE.databaseId, collectionId });
const isCode = (error: unknown, code: number) => (error as { code?: number } | null)?.code === code;
const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);
export const USER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

export const followId = (follower: string, followee: string) => crypto.createHash('sha256').update(`${follower}:${followee}`).digest('hex').slice(0, 32);

export interface PublicProfile {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export function toPublicProfile(doc: Doc | undefined, userId: string): PublicProfile {
  const username = text(doc?.githubUsername, 100) || null;
  const avatar = typeof doc?.avatarUrl === 'string' && doc.avatarUrl.startsWith('https://') ? doc.avatarUrl : username ? `https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=96` : null;
  return { userId, name: text(doc?.displayName, 60) || username || 'Codey typist', username, avatarUrl: avatar };
}

export async function profilesFor(database: SocialDb, ids: string[]): Promise<Map<string, PublicProfile>> {
  const out = new Map<string, PublicProfile>();
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    if (!chunk.length) continue;
    try {
      const { documents } = await database.listDocuments({ ...db(APPWRITE.collections.profiles), queries: [Query.equal('$id', chunk), Query.limit(chunk.length)] });
      for (const doc of documents) out.set(doc.$id, toPublicProfile(doc, doc.$id));
    } catch {
      // Names fall back below.
    }
  }
  for (const id of ids) if (!out.has(id)) out.set(id, toPublicProfile(undefined, id));
  return out;
}

export async function memberProfile(database: SocialDb, userId: string, fallbackName: string): Promise<MemberProfile> {
  const profile = (await profilesFor(database, [userId])).get(userId)!;
  return { name: profile.name === 'Codey typist' && fallbackName ? fallbackName : profile.name, username: profile.username, avatarUrl: profile.avatarUrl };
}

/* ---- League view ---- */

export async function leagueView(database: SocialDb, userId: string, now = new Date()) {
  const week = weekKey(now);
  const player = await loadPlayer(database, userId, week);
  const joined = player.week === week && player.groupId;
  const members = joined ? await listGroup(database, player.groupId) : [];
  const standings = members.map((doc, index) => ({
    rank: index + 1,
    userId: String(doc.userId),
    name: text(doc.name, 64) || 'Codey typist',
    username: text(doc.username, 100) || null,
    avatarUrl: text(doc.avatarUrl, 500) || null,
    xp: Number(doc.xp) || 0,
  }));
  return {
    week,
    endsAt: weekEndsAt(week),
    division: player.division,
    divisionName: DIVISIONS[player.division],
    bestDivision: player.bestDivision,
    joined: Boolean(joined),
    standings,
    rules: { groupSize: GROUP_SIZE, promote: player.division < TOP_DIVISION ? PROMOTE : 0, demote: player.division > 0 && standings.length >= MIN_SIZE_TO_DEMOTE ? DEMOTE : 0 },
    lastWeek: player.lastWeek
      ? { week: player.lastWeek, result: player.lastResult, rank: player.lastRank, from: player.lastDivision, to: player.division }
      : null,
  };
}

/* ---- Follows ---- */

export async function follow(database: SocialDb, follower: string, followee: string) {
  if (follower === followee || !USER_ID.test(followee)) return { following: false };
  const { total = 0 } = await database.listDocuments({ ...db(FOLLOWS), queries: [Query.equal('followerId', follower), Query.limit(1)] });
  if (total >= MAX_FOLLOWING) throw Object.assign(new Error(`You can follow up to ${MAX_FOLLOWING} people.`), { code: 400 });
  try {
    await database.createDocument({ ...db(FOLLOWS), documentId: followId(follower, followee), data: { followerId: follower, followeeId: followee } });
  } catch (error) {
    if (!isCode(error, 409)) throw error;
  }
  return { following: true };
}

export async function unfollow(database: SocialDb, follower: string, followee: string) {
  try {
    await database.deleteDocument({ ...db(FOLLOWS), documentId: followId(follower, followee) });
  } catch (error) {
    if (!isCode(error, 404)) throw error;
  }
  return { following: false };
}

export async function followingIds(database: SocialDb, userId: string): Promise<string[]> {
  const { documents } = await database.listDocuments({ ...db(FOLLOWS), queries: [Query.equal('followerId', userId), Query.limit(MAX_FOLLOWING)] });
  return documents.map((doc) => String(doc.followeeId));
}

export async function relation(database: SocialDb, viewer: string | null, userId: string) {
  const [followers, following, mine] = await Promise.all([
    database.listDocuments({ ...db(FOLLOWS), queries: [Query.equal('followeeId', userId), Query.limit(1)] }),
    database.listDocuments({ ...db(FOLLOWS), queries: [Query.equal('followerId', userId), Query.limit(1)] }),
    viewer && viewer !== userId
      ? database.getDocument({ ...db(FOLLOWS), documentId: followId(viewer, userId) }).then(() => true, () => false)
      : Promise.resolve(false),
  ]);
  return { followers: followers.total ?? 0, following: following.total ?? 0, isFollowing: mine };
}

/* ---- Friends board and feed ---- */

async function runsOf(database: SocialDb, ids: string[], queries: string[]): Promise<Doc[]> {
  if (!ids.length) return [];
  const { documents } = await database.listDocuments({ ...db(LEAGUE.runs), queries: [Query.equal('userId', ids.slice(0, 100)), ...queries] });
  return documents;
}

/** You and everyone you follow, by this week's XP, with their best speed this week. */
export async function friendsBoard(database: SocialDb, userId: string, now = new Date()) {
  const week = weekKey(now);
  const ids = [userId, ...(await followingIds(database, userId))];
  const [profiles, members, runs] = await Promise.all([
    profilesFor(database, ids),
    database.listDocuments({ ...db(LEAGUE.members), queries: [Query.equal('$id', ids.map((id) => memberId(week, id)).slice(0, 100)), Query.limit(100)] }).then((result) => result.documents, () => [] as Doc[]),
    // Ordered by the (userId, $createdAt) index; the best speed is picked below.
    runsOf(database, ids, [Query.greaterThanEqual('$createdAt', `${week}T00:00:00.000Z`), Query.orderDesc('$createdAt'), Query.limit(500)]).catch(() => [] as Doc[]),
  ]);
  const xp = new Map(members.map((doc) => [String(doc.userId), { xp: Number(doc.xp) || 0, division: Number(doc.division) || 0 }]));
  const best = new Map<string, { wpm: number; language: string }>();
  for (const run of runs) {
    const id = String(run.userId);
    const wpm = Number(run.wpm) || 0;
    // Best coding speed; words and passages are a different race.
    if (runKind(text(run.language, 40)) === 'code' && wpm > (best.get(id)?.wpm ?? -1)) best.set(id, { wpm, language: text(run.language, 40) });
  }
  const rows = ids.map((id) => ({
    ...profiles.get(id)!,
    you: id === userId,
    xp: xp.get(id)?.xp ?? 0,
    division: xp.get(id)?.division ?? null,
    bestWpm: best.get(id)?.wpm ?? null,
    bestLanguage: best.get(id)?.language ?? null,
  }));
  rows.sort((a, b) => b.xp - a.xp || (b.bestWpm ?? 0) - (a.bestWpm ?? 0));
  return { week, rows, following: ids.length - 1 };
}

/** Recent runs by people you follow, newest first. */
export async function feed(database: SocialDb, userId: string) {
  const ids = await followingIds(database, userId);
  const runs = await runsOf(database, ids, [Query.orderDesc('$createdAt'), Query.limit(40)]).catch(() => [] as Doc[]);
  const profiles = await profilesFor(database, [...new Set(runs.map((run) => String(run.userId)))]);
  return {
    items: runs
      .filter((run) => (Number(run.wpm) || 0) > 0)
      .map((run) => ({
        id: run.$id,
        at: text(run.$createdAt, 40),
        wpm: Number(run.wpm) || 0,
        accuracy: Number(run.accuracy) || 0,
        language: text(run.language, 40),
        mode: text(run.mode, 10),
        verified: run.verified === true,
        player: profiles.get(String(run.userId))!,
      })),
  };
}

/** Players whose GitHub username or display name starts with the query. */
export async function search(database: SocialDb, viewer: string | null, query: string) {
  const q = query.trim().replace(/^@/, '').slice(0, 40);
  if (q.length < 2) return { results: [] };
  const lists = await Promise.all(['githubUsername', 'displayName'].map((key) =>
    database.listDocuments({ ...db(APPWRITE.collections.profiles), queries: [Query.startsWith(key, q), Query.limit(10)] }).then((result) => result.documents, () => [] as Doc[]),
  ));
  const seen = new Set<string>();
  const docs = lists.flat().filter((doc) => doc.$id !== viewer && !seen.has(doc.$id) && seen.add(doc.$id)).slice(0, 12);
  const followed = viewer ? new Set(await followingIds(database, viewer)) : new Set<string>();
  return { results: docs.map((doc) => ({ ...toPublicProfile(doc, doc.$id), isFollowing: followed.has(doc.$id) })) };
}
