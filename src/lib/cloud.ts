import { AppwriteException, Permission, Query, Role, type Models } from "appwrite";
import type { RunResult, Settings, SnippetLength, TestMode } from "@/types";
import { appwriteConfig, databases } from "@/lib/appwrite";
import { updateAccountPrefs } from "@/lib/account-prefs";
import { getHistory, mergeIntoHistory } from "@/utils/storage";
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM, isWithinLengthSpec } from "@/utils/ranking";

// Keep the pre-rename key to retain existing sync markers.
const SYNCED_RUNS_KEY = "codetype_appwrite_synced_runs_v3";
const inFlightRunUploads = new Map<string, Promise<void>>();
const inFlightLeaderboardRequests = new Map<string, Promise<CloudRun[]>>();

export interface CloudProfile extends Models.Document {
  githubUsername?: string;
  displayName?: string;
  avatarUrl?: string;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate?: string;
}

export interface CloudRun extends Models.Document {
  userId: string;
  language: string;
  mode: TestMode;
  durationMs: number;
  durationSeconds?: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  keystrokes: number;
  mistakes: number;
  snippetsCompleted: number;
  sourceRepo?: string;
  verified: boolean;
  snippetLength?: SnippetLength;
  targetChars?: number;
}

function runKey(run: RunResult): string {
  return run.id ?? `${run.timestamp}-${run.language}-${run.mode}`;
}

function documentId(userId: string, run: RunResult): string {
  if (run.cloudId) return run.cloudId;
  const value = `${userId}:${runKey(run)}`;
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619);
    second = Math.imul(second ^ value.charCodeAt(index), 3266489917);
  }
  return `run_${(first >>> 0).toString(36)}_${(second >>> 0).toString(36)}_${run.timestamp.toString(36)}`.slice(0, 36);
}

function getSyncedKeys(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SYNCED_RUNS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function markSynced(key: string): void {
  try {
    const keys = getSyncedKeys();
    keys.add(key);
    localStorage.setItem(SYNCED_RUNS_KEY, JSON.stringify(Array.from(keys).slice(-1000)));
  } catch {
    // Cloud data is already saved; this marker only avoids a redundant request.
  }
}

function markSyncedMany(newKeys: Iterable<string>): void {
  try {
    const keys = getSyncedKeys();
    for (const key of newKeys) keys.add(key);
    localStorage.setItem(SYNCED_RUNS_KEY, JSON.stringify(Array.from(keys).slice(-1000)));
  } catch {
    // Sync markers are an optimization; cloud data remains the source of truth.
  }
}

/** Attributes added after the first schema rollout; a project missing them must not break sync. */
const OPTIONAL_ATTRIBUTES = ["snippetLength", "targetChars"] as const;

function runData(userId: string, run: RunResult): Record<string, unknown> {
  const data: Record<string, unknown> = {
    userId,
    language: run.language,
    mode: run.mode,
    durationMs: Math.max(0, Math.round(run.duration)),
    wpm: run.wpm,
    rawWpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    correctChars: run.totalCorrect,
    keystrokes: run.charsTyped,
    mistakes: run.totalErrors,
    snippetsCompleted: run.snippetsCompleted,
    verified: false,
  };
  if (run.mode === "timed") data.durationSeconds = Math.max(1, Math.round(run.duration / 1000));
  if (run.mode === "snippet") data.snippetLength = run.snippetLength ?? "medium";
  if (run.mode === "snippet" && run.targetChars !== undefined) data.targetChars = Math.max(0, Math.round(run.targetChars));
  if (run.sourceRepo) data.sourceRepo = run.sourceRepo;
  return data;
}

function withoutOptionalAttributes(data: Record<string, unknown>): Record<string, unknown> {
  const legacy = { ...data };
  for (const attribute of OPTIONAL_ATTRIBUTES) delete legacy[attribute];
  return legacy;
}

function hasOptionalAttributes(data: Record<string, unknown>): boolean {
  return OPTIONAL_ATTRIBUTES.some((attribute) => data[attribute] !== undefined);
}

async function performRunUpload(userId: string, run: RunResult, key: string): Promise<void> {
  if (!databases) return;

  const owner = Role.user(userId);
  const id = documentId(userId, run);
  const request = {
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.runsCollectionId,
    documentId: id,
    permissions: [Permission.read(Role.any()), Permission.update(owner), Permission.delete(owner)],
  };
  const data = runData(userId, run);
  const optional = hasOptionalAttributes(data);
  let fullySynced = true;
  try {
    try {
      await databases.createDocument({ ...request, data });
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        // Existing immutable runs need no update; profile data is joined separately.
        markSynced(key);
        return;
      }
      // Keep cloud history working during the short schema rollout window.
      if (!(error instanceof AppwriteException) || error.code !== 400 || !optional) throw error;
      await databases.createDocument({ ...request, data: withoutOptionalAttributes(data) });
      fullySynced = false;
    }
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      markSynced(key);
      return;
    }
    // Missing optional attributes must not block the rest of cloud sync.
    if (!(error instanceof AppwriteException) || error.code !== 400 || !optional) throw error;
    fullySynced = false;
  }
  // Leaving the key unmarked lets a later sync retry once the schema catches up.
  if (fullySynced) markSynced(key);
}

export function uploadRun(userId: string, run: RunResult): Promise<void> {
  if (!databases) return Promise.resolve();
  const key = `${userId}:${runKey(run)}`;
  if (getSyncedKeys().has(key)) return Promise.resolve();

  const existingUpload = inFlightRunUploads.get(key);
  if (existingUpload) return existingUpload;

  const upload = performRunUpload(userId, run, key).finally(() => {
    inFlightRunUploads.delete(key);
  });
  inFlightRunUploads.set(key, upload);
  return upload;
}

export async function syncLocalRuns(userId: string, runs: RunResult[]): Promise<void> {
  try {
    if (!databases) return;
    const databaseClient = databases;
    // Every saved run belongs to the account; leaderboards filter for rankable runs themselves.
    const eligibleRuns = runs.filter((run) => run.sourceType !== "custom");
    const syncedKeys = getSyncedKeys();
    const pendingRuns = eligibleRuns.filter((run) => !syncedKeys.has(`${userId}:${runKey(run)}`));
    if (pendingRuns.length === 0) return;

    const runsByDocumentId = new Map(pendingRuns.map((run) => [documentId(userId, run), run]));
    const ids = Array.from(runsByDocumentId.keys());
    const existingIds = new Set<string>();

    // Resolve existing immutable runs in batches instead of probing each one with a conflicting create.
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100);
      const response = await databaseClient.listDocuments<CloudRun>({
        databaseId: appwriteConfig.databaseId,
        collectionId: appwriteConfig.runsCollectionId,
        queries: [Query.equal("$id", chunk), Query.limit(chunk.length)],
      });
      for (const document of response.documents) existingIds.add(document.$id);
    }

    markSyncedMany(Array.from(existingIds, (id) => {
      const run = runsByDocumentId.get(id)!;
      return `${userId}:${runKey(run)}`;
    }));

    for (const [id, run] of runsByDocumentId) {
      if (!existingIds.has(id)) await uploadRun(userId, run);
    }
  } catch (error) {
    if (error instanceof AppwriteException && (error.code === 429 || error.message.toLowerCase().includes("rate limit"))) {
      console.warn("Appwrite sync rate limit reached, will retry later gracefully.");
      return;
    }
    console.error("Unable to sync local runs", error);
  }
}

export async function getProfile(userId: string): Promise<CloudProfile | null> {
  if (!databases) return null;
  try {
    return await databases.getDocument<CloudProfile>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.profilesCollectionId,
      documentId: userId,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

export function cloudRunAsResult(run: CloudRun): RunResult {
  return {
    id: `cloud-${run.$id}`,
    cloudId: run.$id,
    language: run.language,
    mode: run.mode,
    duration: run.mode === "timed" && run.durationSeconds ? run.durationSeconds * 1000 : run.durationMs,
    wpm: run.wpm,
    rawWpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    totalCorrect: run.correctChars,
    charsTyped: run.keystrokes,
    totalErrors: run.mistakes,
    snippetsCompleted: run.snippetsCompleted,
    timestamp: new Date(run.$createdAt).getTime(),
    perLineStats: [],
    errorPositions: [],
    sourceRepo: run.sourceRepo,
    snippetLength: run.snippetLength,
    targetChars: run.targetChars,
  };
}

/** Brings runs recorded on other devices into this device's history. Returns how many arrived. */
export async function pullCloudRuns(userId: string): Promise<number> {
  const documents = await listUserRuns(userId);
  const known = new Set(getHistory().map((run) => documentId(userId, run)));
  const incoming = documents.filter((doc) => !known.has(doc.$id)).map(cloudRunAsResult);
  mergeIntoHistory(incoming);
  markSyncedMany(incoming.map((run) => `${userId}:${runKey(run)}`));
  return incoming.length;
}

export async function listUserRuns(userId: string): Promise<CloudRun[]> {
  if (!databases) return [];
  const response = await databases.listDocuments<CloudRun>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.runsCollectionId,
    queries: [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(500)],
  });
  return response.documents;
}

export async function getCloudDailyGoalProgress(userId: string, date: Date = new Date()) {
  const runs = await listUserRuns(userId);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const today = runs.filter((run) => {
    const idParts = run.$id.split("_");
    const encodedTimestamp = idParts[idParts.length - 1];
    const originalTimestamp = encodedTimestamp ? Number.parseInt(encodedTimestamp, 36) : Number.NaN;
    const timestamp = Number.isFinite(originalTimestamp) ? originalTimestamp : new Date(run.$createdAt).getTime();
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });

  return {
    runs: today.length,
    minutes: today.reduce((total, run) => total + run.durationMs / 60000, 0),
    chars: today.reduce((total, run) => total + run.keystrokes, 0),
  };
}

export async function saveCloudGoals(goals: Settings["goals"]): Promise<void> {
  await updateAccountPrefs((prefs) => ({ ...prefs, dailyGoals: goals }));
}

export interface LeaderboardFilters {
  language?: string;
  mode?: TestMode;
  durationSeconds?: number;
  snippetLength?: SnippetLength;
  verifiedOnly?: boolean;
}

const LEADERBOARD_SIZE = 100;
const LEADERBOARD_PAGE = 200;
/** Bounds how far paging will chase distinct typists when one user holds many top runs. */
const LEADERBOARD_MAX_PAGES = 8;

function matchesFilters(run: CloudRun, filters: LeaderboardFilters): boolean {
  if (filters.verifiedOnly && !run.verified) return false;
  if (filters.language && filters.language !== "All" && run.language !== filters.language) return false;
  if (filters.mode && run.mode !== filters.mode) return false;
  if (filters.mode === "timed" && filters.durationSeconds && run.durationSeconds !== filters.durationSeconds) return false;
  if (filters.mode === "snippet") {
    const runLength = run.snippetLength ?? "medium";
    if (filters.snippetLength && runLength !== filters.snippetLength) return false;
  }
  return true;
}

/** The same fairness bar as local runs, applied to whatever the cloud already stores. */
function isRankableCloudRun(run: CloudRun): boolean {
  if (run.mode === "zen") return false;
  if (run.accuracy < MIN_RANKED_ACCURACY) return false;
  if (run.wpm < MIN_RANKED_WPM) return false;
  const runLength = run.snippetLength ?? "medium";
  if (run.mode === "snippet" && !isWithinLengthSpec(runLength, run.targetChars)) return false;
  return true;
}

function buildQueries(filters: LeaderboardFilters, cursor?: string): string[] {
  const queries: string[] = [];
  if (filters.verifiedOnly) queries.push(Query.equal("verified", true));
  if (filters.language && filters.language !== "All") queries.push(Query.equal("language", filters.language));
  if (filters.mode) queries.push(Query.equal("mode", filters.mode));
  if (filters.mode === "timed" && filters.durationSeconds) {
    queries.push(Query.equal("durationSeconds", filters.durationSeconds));
  }
  if (filters.mode === "snippet" && filters.snippetLength) {
    queries.push(Query.equal("snippetLength", filters.snippetLength));
  }
  queries.push(Query.greaterThanEqual("accuracy", MIN_RANKED_ACCURACY));
  queries.push(Query.orderDesc("wpm"), Query.limit(LEADERBOARD_PAGE));
  if (cursor) queries.push(Query.cursorAfter(cursor));
  return queries;
}

/**
 * Returns one best run per typist. Paging happens before deduplication — collapsing
 * a single fetched page would shrink the board to however many distinct users
 * happened to appear in it.
 */
async function fetchLeaderboard(filters: LeaderboardFilters): Promise<CloudRun[]> {
  if (!databases) return [];

  const ranked: CloudRun[] = [];
  const seenUsers = new Set<string>();
  let cursor: string | undefined;
  let indexed = true;

  const collect = (documents: CloudRun[]) => {
    for (const run of documents) {
      if (ranked.length >= LEADERBOARD_SIZE) return;
      if (seenUsers.has(run.userId)) continue;
      if (!matchesFilters(run, filters) || !isRankableCloudRun(run)) continue;
      seenUsers.add(run.userId);
      ranked.push(run);
    }
  };

  for (let page = 0; page < LEADERBOARD_MAX_PAGES && ranked.length < LEADERBOARD_SIZE; page += 1) {
    let documents: CloudRun[];
    try {
      const response = await databases.listDocuments<CloudRun>({
        databaseId: appwriteConfig.databaseId,
        collectionId: appwriteConfig.runsCollectionId,
        queries: indexed ? buildQueries(filters, cursor) : [Query.orderDesc("wpm"), Query.limit(LEADERBOARD_PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      });
      documents = response.documents;
    } catch (error) {
      if (!indexed || !(error instanceof AppwriteException) || error.code !== 400) throw error;
      indexed = false;
      cursor = undefined;
      try {
        const fallbackResponse = await databases.listDocuments<CloudRun>({
          databaseId: appwriteConfig.databaseId,
          collectionId: appwriteConfig.runsCollectionId,
          queries: [Query.orderDesc("wpm"), Query.limit(LEADERBOARD_PAGE)],
        });
        documents = fallbackResponse.documents;
      } catch {
        break;
      }
    }

    collect(documents);
    if (documents.length < LEADERBOARD_PAGE) break;
    cursor = documents[documents.length - 1].$id;
  }

  return ranked;
}

export function listLeaderboard(filters: LeaderboardFilters = {}): Promise<CloudRun[]> {
  const requestKey = JSON.stringify({
    language: filters.language ?? "All",
    mode: filters.mode ?? "all",
    durationSeconds: filters.durationSeconds ?? null,
    snippetLength: filters.snippetLength ?? null,
    verifiedOnly: filters.verifiedOnly ?? false,
  });
  const existingRequest = inFlightLeaderboardRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = fetchLeaderboard(filters).finally(() => {
    inFlightLeaderboardRequests.delete(requestKey);
  });
  inFlightLeaderboardRequests.set(requestKey, request);
  return request;
}

export async function listProfiles(userIds: string[]): Promise<Map<string, CloudProfile>> {
  if (!databases || userIds.length === 0) return new Map();
  const databaseClient = databases;
  const uniqueIds = Array.from(new Set(userIds));
  const chunks: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 100) {
    chunks.push(uniqueIds.slice(index, index + 100));
  }

  const responses = await Promise.all(chunks.map((ids) => databaseClient.listDocuments<CloudProfile>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.profilesCollectionId,
    queries: [Query.equal("$id", ids), Query.limit(ids.length)],
  })));
  return new Map(responses.flatMap((response) => response.documents).map((profile) => [profile.$id, profile]));
}
