import { Query } from 'node-appwrite';
import { APPWRITE } from './appwrite-admin.js';

/**
 * Weekly leagues, Duolingo style. Practice earns XP; the first XP of a week
 * puts the player in a group of up to 30 at their division. When a new week
 * starts, each player's previous week is settled the first time we see them:
 * the top 5 move up a division, the bottom 5 move down.
 *
 * Collections (scripts/setup-appwrite-league.mjs):
 *   league_players  one per player: division, current week and group, last result
 *   league_groups   one per group: week, division, size
 *   league_members  one per player per week: the XP and display data shown in the group
 *   league_xp       one per counted run (id = run id), so a run never counts twice
 */

export const DIVISIONS = ['Bronze', 'Silver', 'Gold', 'Diamond'] as const;
export const TOP_DIVISION = DIVISIONS.length - 1;
export const GROUP_SIZE = 30;
export const PROMOTE = 5;
export const DEMOTE = 5;
/** Demotion needs a group big enough that the bottom five are not most of it. */
export const MIN_SIZE_TO_DEMOTE = 10;
export const MAX_XP_PER_RUN = 60;
export const MAX_XP_PER_DAY = 800;
/** Runs older than this no longer earn XP (e.g. an old history upload). */
export const XP_WINDOW_MS = 36 * 60 * 60 * 1000;

export const LEAGUE = {
  players: process.env.VITE_APPWRITE_LEAGUE_PLAYERS_COLLECTION_ID || 'league_players',
  groups: process.env.VITE_APPWRITE_LEAGUE_GROUPS_COLLECTION_ID || 'league_groups',
  members: process.env.VITE_APPWRITE_LEAGUE_MEMBERS_COLLECTION_ID || 'league_members',
  xp: process.env.VITE_APPWRITE_LEAGUE_XP_COLLECTION_ID || 'league_xp',
  runs: process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || 'runs',
};

type Doc = Record<string, unknown> & { $id: string };

export interface LeagueDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
  createDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown>; permissions?: string[] }): Promise<Doc>;
  updateDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown> }): Promise<Doc>;
  listDocuments(params: { databaseId: string; collectionId: string; queries: string[] }): Promise<{ documents: Doc[]; total?: number }>;
}

const db = (collectionId: string) => ({ databaseId: APPWRITE.databaseId, collectionId });
const isCode = (error: unknown, code: number) => (error as { code?: number } | null)?.code === code;

/* ---- Pure rules ---- */

/** The week a moment falls in, named by its Monday (UTC), e.g. "2026-09-28". */
export function weekKey(date = new Date()): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function weekEndsAt(week: string): string {
  const end = new Date(`${week}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return end.toISOString();
}

/** XP for one run: about one point per ten correct characters, less when sloppy, more when verified. */
export function xpForRun(run: { correctChars: number; accuracy: number; verified?: boolean }): number {
  const chars = Math.max(0, Number(run.correctChars) || 0);
  if (chars < 20) return 0;
  const accuracy = Number(run.accuracy) || 0;
  const care = accuracy >= 95 ? 1 : accuracy >= 90 ? 0.8 : accuracy >= 80 ? 0.5 : 0.25;
  const bonus = run.verified ? 1.5 : 1;
  return Math.max(1, Math.min(MAX_XP_PER_RUN, Math.round((chars / 10) * care * bonus)));
}

export type WeekResult = 'up' | 'down' | 'stay';

/** Where a finished week leaves a player. `rank` is 1-based. */
export function settle(division: number, rank: number, size: number): { division: number; result: WeekResult } {
  if (rank <= PROMOTE && division < TOP_DIVISION) return { division: division + 1, result: 'up' };
  if (division > 0 && size >= MIN_SIZE_TO_DEMOTE && rank > size - DEMOTE) return { division: division - 1, result: 'down' };
  return { division, result: 'stay' };
}

/** Standings order: most XP first, ties to whoever got there first. */
export function rankMembers<T extends { xp: number; updatedAt?: string }>(members: T[]): T[] {
  return [...members].sort((a, b) => b.xp - a.xp || String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')));
}

/* ---- Players and groups ---- */

export interface LeaguePlayer {
  division: number;
  week: string;
  groupId: string;
  lastWeek: string;
  lastResult: string;
  lastRank: number;
  lastDivision: number;
  bestDivision: number;
  xpDate: string;
  xpToday: number;
}

function toPlayer(doc: Doc | null): LeaguePlayer {
  return {
    division: Math.max(0, Math.min(TOP_DIVISION, Number(doc?.division) || 0)),
    week: String(doc?.week ?? ''),
    groupId: String(doc?.groupId ?? ''),
    lastWeek: String(doc?.lastWeek ?? ''),
    lastResult: String(doc?.lastResult ?? ''),
    lastRank: Number(doc?.lastRank) || 0,
    lastDivision: Number(doc?.lastDivision) || 0,
    bestDivision: Number(doc?.bestDivision) || 0,
    xpDate: String(doc?.xpDate ?? ''),
    xpToday: Number(doc?.xpToday) || 0,
  };
}

export const memberId = (week: string, userId: string) => `${week}_${userId}`.slice(0, 36);

export async function listGroup(database: LeagueDb, groupId: string): Promise<Doc[]> {
  if (!groupId) return [];
  const { documents } = await database.listDocuments({ ...db(LEAGUE.members), queries: [Query.equal('groupId', groupId), Query.orderDesc('xp'), Query.limit(GROUP_SIZE + 10)] });
  return rankMembers(documents.map((doc) => ({ ...doc, xp: Number(doc.xp) || 0, updatedAt: String(doc.$updatedAt ?? '') })));
}

/**
 * The player's record, with any finished week settled: a player last seen in
 * an older week moves up, down or stays by their final rank there.
 */
export async function loadPlayer(database: LeagueDb, userId: string, week = weekKey()): Promise<LeaguePlayer> {
  let doc: Doc | null = null;
  try {
    doc = await database.getDocument({ ...db(LEAGUE.players), documentId: userId });
  } catch (error) {
    if (!isCode(error, 404)) throw error;
  }
  const player = toPlayer(doc);
  if (!doc) {
    await database.createDocument({ ...db(LEAGUE.players), documentId: userId, data: { ...player } });
    return player;
  }
  if (!player.week || player.week === week) return player;

  const members = await listGroup(database, player.groupId);
  const rank = members.findIndex((member) => member.userId === userId) + 1;
  const outcome = rank > 0 ? settle(player.division, rank, members.length) : { division: player.division, result: 'stay' as const };
  const settled: LeaguePlayer = {
    ...player,
    division: outcome.division,
    bestDivision: Math.max(player.bestDivision, outcome.division),
    lastWeek: player.week,
    lastResult: outcome.result,
    lastRank: rank,
    lastDivision: player.division,
    week: '',
    groupId: '',
  };
  await database.updateDocument({ ...db(LEAGUE.players), documentId: userId, data: { ...settled } });
  return settled;
}

/** A group at this division with room, or a new one. */
async function openGroup(database: LeagueDb, week: string, division: number): Promise<string> {
  const { documents } = await database.listDocuments({
    ...db(LEAGUE.groups),
    queries: [Query.equal('week', week), Query.equal('division', division), Query.lessThan('size', GROUP_SIZE), Query.orderAsc('number'), Query.limit(1)],
  });
  const open = documents[0];
  if (open) {
    await database.updateDocument({ ...db(LEAGUE.groups), documentId: open.$id, data: { size: (Number(open.size) || 0) + 1 } });
    return open.$id;
  }
  const { total = 0 } = await database.listDocuments({ ...db(LEAGUE.groups), queries: [Query.equal('week', week), Query.equal('division', division), Query.limit(1)] });
  const number = total + 1;
  const id = `${week}-${division}-${number}`;
  try {
    await database.createDocument({ ...db(LEAGUE.groups), documentId: id, data: { week, division, number, size: 1 } });
  } catch (error) {
    // Someone opened the same group a moment ago; join it.
    if (!isCode(error, 409)) throw error;
    const group = await database.getDocument({ ...db(LEAGUE.groups), documentId: id });
    await database.updateDocument({ ...db(LEAGUE.groups), documentId: id, data: { size: (Number(group.size) || 0) + 1 } });
  }
  return id;
}

export interface MemberProfile {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

/** Joins the current week (first XP of the week) and returns the membership id. */
export async function joinWeek(database: LeagueDb, userId: string, player: LeaguePlayer, profile: MemberProfile, week = weekKey()): Promise<LeaguePlayer> {
  if (player.week === week && player.groupId) return player;
  const groupId = await openGroup(database, week, player.division);
  try {
    await database.createDocument({
      ...db(LEAGUE.members),
      documentId: memberId(week, userId),
      data: { week, groupId, userId, division: player.division, xp: 0, name: profile.name.slice(0, 64), username: profile.username ?? '', avatarUrl: profile.avatarUrl ?? '' },
    });
  } catch (error) {
    if (!isCode(error, 409)) throw error;
  }
  const joined = { ...player, week, groupId };
  await database.updateDocument({ ...db(LEAGUE.players), documentId: userId, data: { week, groupId } });
  return joined;
}

/* ---- Earning XP ---- */

export interface XpAward {
  gained: number;
  weekXp: number;
  /** Players this run pushed past, for "you were overtaken" notifications. */
  overtaken: string[];
  groupId: string;
  division: number;
}

/**
 * Counts a stored run towards this week's league, once. The run must belong to
 * the player and be recent; XP is capped per run and per day.
 */
export async function awardRun(database: LeagueDb, userId: string, runId: string, profile: MemberProfile, now = new Date()): Promise<XpAward | null> {
  let run: Doc;
  try {
    run = await database.getDocument({ ...db(LEAGUE.runs), documentId: runId });
  } catch (error) {
    if (isCode(error, 404)) return null;
    throw error;
  }
  if (run.userId !== userId) return null;
  const createdAt = new Date(String(run.$createdAt ?? '')).getTime();
  if (!createdAt || now.getTime() - createdAt > XP_WINDOW_MS) return null;
  const earned = xpForRun({ correctChars: Number(run.correctChars) || 0, accuracy: Number(run.accuracy) || 0, verified: run.verified === true });
  if (!earned) return null;

  const week = weekKey(now);
  const today = now.toISOString().slice(0, 10);
  let player = await loadPlayer(database, userId, week);
  const usedToday = player.xpDate === today ? player.xpToday : 0;
  const gained = Math.min(earned, Math.max(0, MAX_XP_PER_DAY - usedToday));

  try {
    await database.createDocument({ ...db(LEAGUE.xp), documentId: runId, data: { userId, week, xp: gained } });
  } catch (error) {
    if (isCode(error, 409)) return null; // Already counted.
    throw error;
  }

  player = await joinWeek(database, userId, player, profile, week);
  const id = memberId(week, userId);
  const member = await database.getDocument({ ...db(LEAGUE.members), documentId: id });
  const before = Number(member.xp) || 0;
  const after = before + gained;
  if (gained > 0) {
    await database.updateDocument({ ...db(LEAGUE.members), documentId: id, data: { xp: after, name: profile.name.slice(0, 64), avatarUrl: profile.avatarUrl ?? '' } });
    await database.updateDocument({ ...db(LEAGUE.players), documentId: userId, data: { xpDate: today, xpToday: usedToday + gained } });
  }

  let overtaken: string[] = [];
  if (gained > 0) {
    const { documents } = await database.listDocuments({
      ...db(LEAGUE.members),
      queries: [Query.equal('groupId', player.groupId), Query.greaterThanEqual('xp', before), Query.lessThan('xp', after), Query.limit(GROUP_SIZE)],
    });
    // Only people who were ahead or level and had some XP of their own.
    overtaken = documents.filter((doc) => doc.userId !== userId && (Number(doc.xp) || 0) > 0).map((doc) => String(doc.userId));
  }
  return { gained, weekXp: after, overtaken, groupId: player.groupId, division: player.division };
}

