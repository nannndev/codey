import { Query } from 'node-appwrite';
import { APPWRITE, adminDatabases } from './appwrite-admin.js';
import { languageLabel, metaPageHtml, RUN_ID_PATTERN } from './share-card.js';
import { CARD_VERSION } from '../../src/utils/share-card-version.js';
import { average, languageSummary, streakFromRuns } from '../../src/lib/run-stats.js';
import { calculateCodeIndex, getDivisionInfo } from '../../src/utils/division.js';
import { evaluate, TIER_NAMES, type SnapshotRun, type Tier } from '../../src/lib/achievements.js';

/**
 * Public profile cards: /p/<userId> serves Open Graph tags and
 * /api/og/<userId>?kind=profile draws the card, both from the player's
 * cloud runs, computed the same way the profile page does.
 */

export const PROFILE_TREND_RUNS = 16;

export interface SharedProfile {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  runs: number;
  bestWpm: number;
  bestLanguage: string;
  avgWpm: number;
  avgAccuracy: number;
  bestStreak: number;
  topLanguage: string | null;
  division: { name: string; color: string } | null;
  /** WPM of the most recent runs, oldest first. */
  trend: number[];
  /** Badges earned, from the same verified data a visitor's profile page uses. */
  badges: { earned: number; top: ProfileBadge[] };
}

export interface ProfileBadge {
  name: string;
  /** "Gold", "Diamond"… or "Feat" for one-off badges. */
  level: string;
  color: string;
}

const TIER_COLORS: Record<Tier, string> = { 1: '#d97706', 2: '#cbd5e1', 3: '#facc15', 4: '#67e8f9' };
// Time-of-day feats depend on the player's clock, which the server does not know.
const CLOCK_FEATS = new Set(['night-owl', 'early-bird']);

type Doc = Record<string, unknown>;

export interface ProfileDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
  listDocuments(params: { databaseId: string; collectionId: string; queries: string[] }): Promise<{ documents: Doc[]; total?: number }>;
}

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);

export async function loadSharedProfile(userId: string, db: ProfileDb = adminDatabases() as unknown as ProfileDb): Promise<SharedProfile | null> {
  if (!RUN_ID_PATTERN.test(userId)) return null;
  let profile: Doc;
  try {
    profile = await db.getDocument({ databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.profiles, documentId: userId });
  } catch {
    return null;
  }
  let docs: Doc[] = [];
  try {
    const response = await db.listDocuments({
      databaseId: APPWRITE.databaseId,
      collectionId: process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || 'runs',
      queries: [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(500)],
    });
    docs = response.documents;
  } catch {
    // A profile without readable runs still shares, with empty numbers.
  }
  let dailyCompleted = 0;
  try {
    const daily = await db.listDocuments({
      databaseId: APPWRITE.databaseId,
      collectionId: APPWRITE.collections.dailyRuns,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    });
    dailyCompleted = daily.total ?? daily.documents.length;
  } catch {
    // Daily badges are left out when the board cannot be read.
  }
  const runs = docs
    .map((doc) => ({
      timestamp: new Date(text(doc.$createdAt, 40)).getTime() || 0,
      wpm: Number(doc.wpm) || 0,
      accuracy: Number(doc.accuracy) || 0,
      language: languageLabel(text(doc.language, 40)),
      mode: text(doc.mode, 10),
      duration: Number(doc.durationMs) || 0,
      charsTyped: Number(doc.keystrokes) || 0,
      verified: doc.verified === true,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const best = runs.reduce<(typeof runs)[number] | null>((top, run) => (!top || run.wpm > top.wpm ? run : top), null);
  const avgAccuracy = average(runs.map((run) => run.accuracy));
  const username = text(profile.githubUsername, 100) || null;
  const byLanguage = languageSummary(runs);
  const division = best ? getDivisionInfo(calculateCodeIndex(best.wpm, avgAccuracy)) : null;
  const bestStreak = Math.max(Number(profile.bestStreak) || 0, streakFromRuns(runs).best);
  const snapshotRuns: SnapshotRun[] = runs.map(({ timestamp, wpm, accuracy, language, duration, charsTyped }) => ({ timestamp, wpm, accuracy, language, duration, charsTyped }));
  const evaluation = evaluate({
    runs: snapshotRuns,
    bestStreak,
    keystrokes: null,
    duelWins: null,
    partyWins: null,
    dailyCompleted,
    rankedVerified: runs.filter((run) => run.verified).length,
  });
  const families = evaluation.families
    .filter((item) => item.tier > 0)
    .sort((a, b) => b.tier - a.tier)
    .map((item) => ({ name: item.family.name, level: TIER_NAMES[item.tier as Tier], color: TIER_COLORS[item.tier as Tier] }));
  const feats = evaluation.singles
    .filter((item) => item.unlocked && !CLOCK_FEATS.has(item.single.id))
    .map((item) => ({ name: item.single.name, level: 'Feat', color: '#f472b6' }));
  const earned = [...evaluation.earned].filter((id) => !CLOCK_FEATS.has(id)).length;
  return {
    userId,
    name: text(profile.displayName, 60) || username || 'A Codey typist',
    username,
    avatarUrl: typeof profile.avatarUrl === 'string' && profile.avatarUrl.startsWith('https://') ? profile.avatarUrl : username ? `https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=200` : null,
    runs: runs.length,
    bestWpm: best?.wpm ?? 0,
    bestLanguage: best?.language ?? 'Code',
    avgWpm: average(runs.map((run) => run.wpm)),
    avgAccuracy,
    bestStreak,
    topLanguage: byLanguage[0]?.language ?? null,
    division: division ? { name: division.subRank, color: division.color } : null,
    trend: runs.slice(-PROFILE_TREND_RUNS).map((run) => Math.round(run.wpm)),
    badges: { earned, top: [...families, ...feats].slice(0, 3) },
  };
}

export function profileTitle(profile: SharedProfile) {
  return profile.runs ? `${profile.name} on Codey: ${profile.bestWpm.toFixed(1)} WPM best` : `${profile.name} on Codey`;
}

export function profileDescription(profile: SharedProfile) {
  if (!profile.runs) return 'Typing practice with real code from GitHub, daily challenges and live duels.';
  const parts = [`${profile.runs} runs`, `${profile.avgWpm.toFixed(1)} WPM average`, `${profile.avgAccuracy.toFixed(1)}% accuracy`];
  if (profile.division) parts.push(profile.division.name);
  if (profile.badges.earned) parts.push(`${profile.badges.earned} badges`);
  return `${parts.join(' · ')}. Practice typing real code on Codey.`;
}

export function profileShareHtml(profile: SharedProfile | null, origin: string, userId: string) {
  return metaPageHtml({
    title: profile ? profileTitle(profile) : 'Codey: type real code, faster',
    description: profile ? profileDescription(profile) : 'Typing practice with real code from GitHub, daily challenges and live duels.',
    image: profile ? `${origin}/api/og/${encodeURIComponent(userId)}?kind=profile&v=${CARD_VERSION}` : `${origin}/og-default.png?v=${CARD_VERSION}`,
    url: `${origin}/p/${encodeURIComponent(userId)}`,
    target: profile ? `${origin}/profile/${encodeURIComponent(userId)}` : origin,
  });
}
