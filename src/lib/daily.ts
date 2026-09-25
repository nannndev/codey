import type { CloudProfile } from "./cloud";
import { apiError, getJwtToken, rankedApiUrl } from "./ranked";
import type { Snippet } from "@/types";

/** Client for /api/daily: one GitHub-sourced snippet per UTC day. */

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

export interface DailyStreak {
  current: number;
  best: number;
}

export interface DailyBoard {
  date: string;
  nextResetAt: string;
  challenge: DailyChallenge;
  runs: DailyRun[];
  profiles: Map<string, CloudProfile>;
  streak: DailyStreak | null;
}

export interface DailySubmitResult {
  verified: boolean;
  wpm: number;
  accuracy: number;
  improved: boolean;
  best: { wpm: number; accuracy: number; attempts: number };
  rank: number;
  streak: DailyStreak;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; value: Promise<DailyBoard> }>();

export function dailySnippet(challenge: DailyChallenge): Snippet {
  return {
    id: `daily-${challenge.date}`,
    language: challenge.language,
    code: challenge.code,
    filename: challenge.filename,
    source: { repo: challenge.sourceRepo, url: challenge.sourceUrl },
    sourceType: "public",
  };
}

export function getDailyBoard(userId?: string | null, { fresh = false } = {}): Promise<DailyBoard> {
  const key = userId ?? "";
  const cached = cache.get(key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.value;

  const params = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const value = fetch(rankedApiUrl(`/api/daily${params}`)).then(async (response) => {
    if (!response.ok) throw await apiError(response, "Today's challenge could not be loaded.");
    const payload = await response.json() as Omit<DailyBoard, "profiles"> & { profiles: CloudProfile[] };
    return { ...payload, profiles: new Map(payload.profiles.map((profile) => [profile.$id, profile])) };
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  value.catch(() => cache.delete(key));
  return value;
}

export function invalidateDailyBoard() {
  cache.clear();
}

async function authedPost<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error("Sign in with GitHub to post a daily score.");
  const response = await fetch(rankedApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response, fallback);
  return response.json() as Promise<T>;
}

export function startDailyAttempt() {
  return authedPost<{ sessionId: string; date: string; expiresAt: string }>("/api/daily/start", {}, "Daily attempt could not be started.");
}

export function submitDailyAttempt(payload: {
  sessionId: string;
  date: string;
  completedCode: string;
  mistakes: number;
  keystrokes: number;
  correctChars: number;
  totalMs: number;
  keyIntervals: number[];
}) {
  return authedPost<DailySubmitResult>("/api/daily/submit", payload, "Daily score could not be verified.");
}
