import { account } from './appwrite';
import type { SnippetLength, TestMode } from '../types';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const needsRemoteServerlessApi = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');
const API_BASE_URL = configuredApiBase || (needsRemoteServerlessApi ? 'https://codey-opal.vercel.app' : '');

export function rankedApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export interface RankedChallenge {
  sessionId: string;
  challengeHash: string;
  snippetCode: string;
  language: string;
  mode: TestMode;
  snippetLength: SnippetLength;
  durationSeconds?: number;
  targetChars: number;
  expiresAt: string;
}

export interface RankedSubmission {
  sessionId: string;
  challengeHash: string;
  completedCode: string;
  mistakes: number;
  keystrokes: number;
  correctChars: number;
  totalMs: number;
  keyIntervals: number[];
  language: string;
  mode: TestMode;
  snippetLength: SnippetLength;
  durationSeconds?: number;
}

export interface RankedResult {
  verified: boolean;
  runId: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
}

export interface RankedStart {
  startedAt: string;
  expiresAt: string;
}

export async function getJwtToken(): Promise<string | null> {
  if (!account) return null;
  try {
    const session = await account.createJWT();
    return session.jwt;
  } catch {
    return null;
  }
}

export async function apiError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json() as { error?: string };
    return new Error(payload.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function requestRankedChallenge(params: {
  language: string;
  mode: TestMode;
  snippetLength?: SnippetLength;
  durationSeconds?: number;
}): Promise<RankedChallenge> {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error('You must be signed in with GitHub to play Ranked Mode.');

  const response = await fetch(rankedApiUrl('/api/ranked/challenge'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw await apiError(response, 'Ranked verification service is unavailable.');
  return await response.json() as RankedChallenge;
}

export async function startRankedChallenge(sessionId: string): Promise<RankedStart> {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error('Authentication lost before Ranked start.');

  const response = await fetch(rankedApiUrl('/api/ranked/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw await apiError(response, 'Ranked session could not be started.');
  return await response.json() as RankedStart;
}

export async function submitRankedRun(payload: RankedSubmission): Promise<RankedResult> {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error('Authentication lost during Ranked submission.');

  const response = await fetch(rankedApiUrl('/api/ranked/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await apiError(response, 'Ranked result could not be verified or recorded.');
  return await response.json() as RankedResult;
}
