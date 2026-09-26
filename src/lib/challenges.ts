import { ID, type Models } from "appwrite";
import { appwriteConfig, databases } from "./appwrite";
import type { RunResult, Snippet } from "@/types";

/**
 * "Challenge a friend": a finished snippet run saved with its exact code, so
 * whoever opens the link types the same snippet against the same score.
 */

export const CHALLENGE_CODE_LIMIT = 16_000;
export const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9_]{1,36}$/;

export interface Challenge {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  language: string;
  code: string;
  filename: string | null;
  sourceRepo: string | null;
  sourceUrl: string | null;
  wpm: number;
  accuracy: number;
  createdAt: string;
}

type ChallengeDocument = Models.Document & Omit<Challenge, "id" | "createdAt">;

/** Only public snippets can be challenges: custom code stays private. */
export function canChallenge(snippet: Snippet | null | undefined, result: RunResult): snippet is Snippet {
  return Boolean(snippet && snippet.sourceType !== "custom" && result.mode === "snippet" && snippet.code.trim() && snippet.code.length <= CHALLENGE_CODE_LIMIT);
}

export function challengeSnippet(challenge: Challenge): Snippet {
  return {
    id: `challenge-${challenge.id}`,
    language: challenge.language,
    code: challenge.code,
    filename: challenge.filename ?? undefined,
    source: challenge.sourceRepo ? { repo: challenge.sourceRepo, url: challenge.sourceUrl ?? `https://github.com/${challenge.sourceRepo}` } : undefined,
    sourceType: "public",
  };
}

function fromDocument(doc: ChallengeDocument): Challenge {
  return {
    id: doc.$id,
    userId: doc.userId,
    name: doc.name,
    username: doc.username || null,
    language: doc.language,
    code: doc.code,
    filename: doc.filename || null,
    sourceRepo: doc.sourceRepo || null,
    sourceUrl: doc.sourceUrl || null,
    wpm: doc.wpm,
    accuracy: doc.accuracy,
    createdAt: doc.$createdAt,
  };
}

const created = new Map<string, Promise<string>>();

/** Saves the challenge once per run; returns its id. */
export function createChallenge(owner: { id: string; name: string; username?: string | null }, snippet: Snippet, result: RunResult): Promise<string> {
  const key = `${owner.id}:${result.id ?? result.timestamp}`;
  const existing = created.get(key);
  if (existing) return existing;
  if (!databases) return Promise.reject(new Error("Challenges need the cloud to be configured."));
  const database = databases;
  const request = database.createDocument<ChallengeDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.challengesCollectionId,
    documentId: ID.unique(),
    data: {
      userId: owner.id,
      name: owner.name.slice(0, 64) || "A Codey typist",
      username: owner.username?.slice(0, 64) || null,
      language: snippet.language.slice(0, 64),
      code: snippet.code,
      filename: snippet.filename?.slice(0, 256) || null,
      sourceRepo: snippet.source?.repo?.slice(0, 200) || null,
      sourceUrl: snippet.source?.url?.slice(0, 500) || null,
      wpm: Math.round(result.wpm * 10) / 10,
      accuracy: Math.round(result.accuracy * 10) / 10,
    },
  }).then((doc) => doc.$id);
  created.set(key, request);
  request.catch(() => created.delete(key));
  return request;
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  if (!databases || !CHALLENGE_ID_PATTERN.test(id)) return null;
  try {
    const doc = await databases.getDocument<ChallengeDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.challengesCollectionId,
      documentId: id,
    });
    return fromDocument(doc);
  } catch {
    return null;
  }
}

export interface ChallengeOutcome {
  won: boolean;
  /** Your WPM minus theirs. */
  margin: number;
  tie: boolean;
}

/** Faster wins; equal speed goes to the more accurate run. */
export function judgeChallenge(challenge: Pick<Challenge, "wpm" | "accuracy">, result: Pick<RunResult, "wpm" | "accuracy">): ChallengeOutcome {
  const margin = Math.round((result.wpm - challenge.wpm) * 10) / 10;
  if (margin !== 0) return { won: margin > 0, margin, tie: false };
  const accuracy = result.accuracy - challenge.accuracy;
  return { won: accuracy > 0, margin, tie: accuracy === 0 };
}

export function challengeShareUrl(origin: string, id: string) {
  return `${origin}/c/${encodeURIComponent(id)}`;
}

export function challengeShareText(challenge: Pick<Challenge, "wpm" | "language">, own: boolean, name?: string) {
  const where = challenge.language.toLowerCase() === "all" ? "" : ` in ${challenge.language}`;
  return own
    ? `I typed this snippet at ${challenge.wpm.toFixed(1)} WPM${where}. Can you beat me?`
    : `${name ?? "Someone"} typed this snippet at ${challenge.wpm.toFixed(1)} WPM${where}. Can you beat it?`;
}
