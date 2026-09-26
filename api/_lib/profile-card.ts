import { Query } from 'node-appwrite';
import { APPWRITE, adminDatabases } from './appwrite-admin.js';
import { languageLabel, metaPageHtml, RUN_ID_PATTERN } from './share-card.js';
import { CARD_VERSION } from '../../src/utils/share-card-version.js';
import { average, languageSummary, streakFromRuns } from '../../src/lib/run-stats.js';
import { calculateCodeIndex, getDivisionInfo } from '../../src/utils/division.js';

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
}

type Doc = Record<string, unknown>;

export interface ProfileDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
  listDocuments(params: { databaseId: string; collectionId: string; queries: string[] }): Promise<{ documents: Doc[] }>;
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
  const runs = docs
    .map((doc) => ({
      timestamp: new Date(text(doc.$createdAt, 40)).getTime() || 0,
      wpm: Number(doc.wpm) || 0,
      accuracy: Number(doc.accuracy) || 0,
      language: languageLabel(text(doc.language, 40)),
      mode: text(doc.mode, 10),
      duration: Number(doc.durationMs) || 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const best = runs.reduce<(typeof runs)[number] | null>((top, run) => (!top || run.wpm > top.wpm ? run : top), null);
  const avgAccuracy = average(runs.map((run) => run.accuracy));
  const username = text(profile.githubUsername, 100) || null;
  const byLanguage = languageSummary(runs);
  const division = best ? getDivisionInfo(calculateCodeIndex(best.wpm, avgAccuracy)) : null;
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
    bestStreak: Math.max(Number(profile.bestStreak) || 0, streakFromRuns(runs).best),
    topLanguage: byLanguage[0]?.language ?? null,
    division: division ? { name: division.subRank, color: division.color } : null,
    trend: runs.slice(-PROFILE_TREND_RUNS).map((run) => Math.round(run.wpm)),
  };
}

export function profileTitle(profile: SharedProfile) {
  return profile.runs ? `${profile.name} on Codey: ${profile.bestWpm.toFixed(1)} WPM best` : `${profile.name} on Codey`;
}

export function profileDescription(profile: SharedProfile) {
  if (!profile.runs) return 'Typing practice with real code from GitHub, daily challenges and live duels.';
  const parts = [`${profile.runs} runs`, `${profile.avgWpm.toFixed(1)} WPM average`, `${profile.avgAccuracy.toFixed(1)}% accuracy`];
  if (profile.division) parts.push(profile.division.name);
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
