import crypto from 'node:crypto';
import { Permission, Query, Role } from 'node-appwrite';
import { LANGUAGE_CONFIG, discoverRepos, shuffle, snippetsFromRepo, type DynamicSnippet } from './github-snippets.js';
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM, SNIPPET_LENGTH_SPEC } from '../../src/utils/ranking.js';
import { APPWRITE } from './appwrite-admin.js';

/**
 * Daily challenge: one snippet per UTC day, picked live from GitHub by the
 * first request of the day and then frozen in Appwrite so every player types
 * exactly the same code. There is no built-in snippet list behind it.
 */

/** The subset of Appwrite Databases the daily logic needs (lets tests use a fake). */
export interface DailyDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Record<string, unknown>>;
  createDocument(params: {
    databaseId: string;
    collectionId: string;
    documentId: string;
    data: Record<string, unknown>;
    permissions?: string[];
  }): Promise<Record<string, unknown>>;
  updateDocument(params: {
    databaseId: string;
    collectionId: string;
    documentId: string;
    data: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  listDocuments(params: { databaseId: string; collectionId: string; queries?: string[] }): Promise<{
    total: number;
    documents: Array<Record<string, unknown>>;
  }>;
}

export interface DailyChallenge {
  date: string;
  language: string;
  code: string;
  filename: string;
  sourceRepo: string;
  sourceUrl: string;
}

export interface DailyRun {
  $id: string;
  date: string;
  userId: string;
  language: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
  mistakes: number;
  keystrokes: number;
  attempts: number;
  bestAt: string;
}

/** Languages the rotation walks through, in the snippet service's order. */
export const DAILY_LANGUAGES = Object.keys(LANGUAGE_CONFIG);

const DAY_MS = 24 * 60 * 60 * 1000;
const SPEC = SNIPPET_LENGTH_SPEC.medium;

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function dayNumber(key: string): number {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
}

export function languageForDate(key: string): string {
  return DAILY_LANGUAGES[((dayNumber(key) % DAILY_LANGUAGES.length) + DAILY_LANGUAGES.length) % DAILY_LANGUAGES.length];
}

export function nextResetAt(now = new Date()): string {
  return new Date(Date.parse(`${utcDateKey(now)}T00:00:00Z`) + DAY_MS).toISOString();
}

/** Trim to the medium length band on a line boundary so daily runs are comparable. */
export function fitToDailyLength(code: string): string {
  let fitted = code.trim();
  if (fitted.length > SPEC.maxChars) {
    const cutAt = fitted.lastIndexOf('\n', SPEC.maxChars);
    fitted = (cutAt > SPEC.maxChars / 3 ? fitted.slice(0, cutAt) : fitted.slice(0, SPEC.maxChars)).trimEnd();
  }
  return fitted;
}

/** Live GitHub pick for one language; null when nothing typing-sized was found. */
export async function pickSnippet(language: string): Promise<DynamicSnippet | null> {
  const repos = shuffle(await discoverRepos(language)).slice(0, 4);
  for (const repo of repos) {
    const snippets = await snippetsFromRepo(language, repo).catch(() => []);
    const usable = snippets
      .map((snippet) => ({ ...snippet, code: fitToDailyLength(snippet.code) }))
      .filter((snippet) => snippet.code.length >= SPEC.minChars);
    if (usable.length) return usable[Math.floor(Math.random() * usable.length)];
  }
  return null;
}

function isStatus(error: unknown, code: number): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === code;
}

function toChallenge(doc: Record<string, unknown>): DailyChallenge {
  return {
    date: String(doc.date),
    language: String(doc.language),
    code: String(doc.code),
    filename: String(doc.filename ?? ''),
    sourceRepo: String(doc.sourceRepo ?? ''),
    sourceUrl: String(doc.sourceUrl ?? ''),
  };
}

const challengeCache = new Map<string, DailyChallenge>();

/** Frozen challenge for a date, if it was ever created. */
export async function findChallenge(db: DailyDb, key: string): Promise<DailyChallenge | null> {
  const cached = challengeCache.get(key);
  if (cached) return cached;
  try {
    const challenge = toChallenge(await db.getDocument({
      databaseId: APPWRITE.databaseId,
      collectionId: APPWRITE.collections.dailyChallenges,
      documentId: key,
    }));
    challengeCache.set(key, challenge);
    return challenge;
  } catch (error) {
    if (isStatus(error, 404)) return null;
    throw error;
  }
}

/**
 * Today's challenge, creating it on the first request. If the rotation's
 * language yields nothing, the next languages are tried; if GitHub is fully
 * unreachable this throws and nothing is frozen, so a later request retries.
 */
export async function getOrCreateChallenge(db: DailyDb, key: string, pick = pickSnippet): Promise<DailyChallenge> {
  const existing = await findChallenge(db, key);
  if (existing) return existing;

  const start = DAILY_LANGUAGES.indexOf(languageForDate(key));
  let snippet: DynamicSnippet | null = null;
  for (let offset = 0; offset < 3 && !snippet; offset += 1) {
    snippet = await pick(DAILY_LANGUAGES[(start + offset) % DAILY_LANGUAGES.length]);
  }
  if (!snippet) throw new Error('No GitHub snippet available for today yet.');

  const data = {
    date: key,
    language: snippet.language,
    code: snippet.code,
    filename: snippet.filename,
    sourceRepo: snippet.source.repo,
    sourceUrl: snippet.source.url,
  };
  try {
    await db.createDocument({
      databaseId: APPWRITE.databaseId,
      collectionId: APPWRITE.collections.dailyChallenges,
      documentId: key,
      data,
      permissions: [Permission.read(Role.any())],
    });
  } catch (error) {
    // Another request froze today's challenge first; everyone uses that one.
    if (isStatus(error, 409)) {
      const winner = await findChallenge(db, key);
      if (winner) return winner;
    }
    throw error;
  }
  const challenge = toChallenge(data);
  challengeCache.set(key, challenge);
  return challenge;
}

/** Stable per-user-per-day document ID within Appwrite's 36-character limit. */
export function dailyRunId(key: string, userId: string): string {
  return crypto.createHash('sha256').update(`${key}:${userId}`).digest('hex').slice(0, 32);
}

/** Binds a run session to one user, day and session ID. */
export function sessionChallengeHash(key: string, userId: string, sessionId: string): string {
  return crypto.createHash('sha256').update(`daily:${key}:${userId}:${sessionId}`).digest('hex');
}

export async function listBoard(db: DailyDb, key: string, limit = 100): Promise<DailyRun[]> {
  const response = await db.listDocuments({
    databaseId: APPWRITE.databaseId,
    collectionId: APPWRITE.collections.dailyRuns,
    queries: [Query.equal('date', key), Query.orderDesc('wpm'), Query.limit(limit)],
  });
  return response.documents as unknown as DailyRun[];
}

/** Current streak (ending today or yesterday) and best streak from played dates. */
export function computeStreaks(dates: string[], today: string): { current: number; best: number } {
  const days = [...new Set(dates.filter(isDateKey).map(dayNumber))].sort((a, b) => b - a);
  if (!days.length) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i - 1] - days[i] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const todayNumber = dayNumber(today);
  let current = 0;
  if (days[0] === todayNumber || days[0] === todayNumber - 1) {
    current = 1;
    for (let i = 1; i < days.length && days[i - 1] - days[i] === 1; i += 1) current += 1;
  }
  return { current, best: Math.max(best, current) };
}

export async function userStreaks(db: DailyDb, userId: string, today: string) {
  const response = await db.listDocuments({
    databaseId: APPWRITE.databaseId,
    collectionId: APPWRITE.collections.dailyRuns,
    queries: [Query.equal('userId', userId), Query.orderDesc('date'), Query.limit(400)],
  });
  return computeStreaks(response.documents.map((doc) => String(doc.date)), today);
}

export interface SubmittedMetrics {
  completedCode: string;
  mistakes: number;
  keystrokes: number;
  correctChars: number;
  totalMs: number;
  keyIntervals: number[];
}

/**
 * Authoritative metrics plus the same plausibility checks Ranked uses.
 * Returns an error message when the run must be rejected.
 */
export function scoreRun(code: string, input: SubmittedMetrics): { error: string } | {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  keystrokes: number;
} {
  if (input.completedCode !== code) return { error: 'Submitted code does not match today\'s challenge.' };
  const charLength = code.length;
  const totalMs = Math.max(1, Number(input.totalMs) || 0);
  const mistakes = Math.max(0, Math.round(Number(input.mistakes) || 0));
  const keystrokes = Math.max(charLength, Math.round(Number(input.keystrokes) || 0));
  const correct = Math.max(0, Math.min(charLength, Math.round(Number(input.correctChars) || 0)));
  const minutes = Math.max(0.001, totalMs / 60000);
  const wpm = Number(((correct / 5) / minutes).toFixed(1));
  const rawWpm = Number(((keystrokes / 5) / minutes).toFixed(1));
  const accuracy = Number(Math.max(0, Math.min(100, ((keystrokes - mistakes) / keystrokes) * 100)).toFixed(1));

  if (accuracy < MIN_RANKED_ACCURACY) return { error: `Accuracy ${accuracy}% is below the ${MIN_RANKED_ACCURACY}% minimum.` };
  if (wpm < MIN_RANKED_WPM) return { error: `WPM ${wpm} is below the ${MIN_RANKED_WPM} WPM minimum.` };
  if (wpm > 250) return { error: 'Run rejected: WPM exceeds plausibility threshold.' };
  if (charLength >= 50 && totalMs < charLength * 12) return { error: 'Run rejected: duration is impossibly short.' };
  const intervals = Array.isArray(input.keyIntervals) ? input.keyIntervals.filter((value) => Number.isFinite(value)) : [];
  if (intervals.length > 20 && Math.min(...intervals) < 2) return { error: 'Run rejected: synthetic keypress timing detected.' };

  return { wpm, rawWpm, accuracy, keystrokes };
}

/** Keep each player's best run for the day; count every verified attempt. */
export async function recordBest(
  db: DailyDb,
  key: string,
  userId: string,
  language: string,
  run: { wpm: number; rawWpm: number; accuracy: number; keystrokes: number; mistakes: number; durationMs: number },
): Promise<{ best: DailyRun; improved: boolean }> {
  const documentId = dailyRunId(key, userId);
  const common = { databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.dailyRuns, documentId };
  let existing: DailyRun | null = null;
  try {
    existing = await db.getDocument(common) as unknown as DailyRun;
  } catch (error) {
    if (!isStatus(error, 404)) throw error;
  }

  const bestFields = { ...run, bestAt: new Date().toISOString() };
  if (!existing) {
    const data = { date: key, userId, language, attempts: 1, ...bestFields };
    await db.createDocument({ ...common, data, permissions: [Permission.read(Role.any())] });
    return { best: { $id: documentId, ...data }, improved: true };
  }

  const improved = run.wpm > existing.wpm || (run.wpm === existing.wpm && run.accuracy > existing.accuracy);
  const data = improved ? { attempts: existing.attempts + 1, ...bestFields } : { attempts: existing.attempts + 1 };
  await db.updateDocument({ ...common, data });
  return { best: { ...existing, ...data }, improved };
}

export async function rankOf(db: DailyDb, key: string, wpm: number): Promise<number> {
  const ahead = await db.listDocuments({
    databaseId: APPWRITE.databaseId,
    collectionId: APPWRITE.collections.dailyRuns,
    queries: [Query.equal('date', key), Query.greaterThan('wpm', wpm), Query.limit(1)],
  });
  return ahead.total + 1;
}
