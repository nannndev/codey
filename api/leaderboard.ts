import { Client, Databases, Query } from "node-appwrite";
import type { SnippetLength, TestMode } from "../src/types.js";
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM, isTextLanguage, isWithinLengthSpec } from "../src/utils/ranking.js";

interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

interface RunDocument {
  $id: string;
  userId: string;
  language: string;
  mode: TestMode;
  durationSeconds?: number;
  accuracy: number;
  wpm: number;
  verified: boolean;
  snippetLength?: SnippetLength;
  targetChars?: number;
  [key: string]: unknown;
}

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || "codetype";
const runsCollectionId = process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || "runs";
const profilesCollectionId = process.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles";
const apiKey = process.env.APPWRITE_API_KEY;
const PAGE_SIZE = 200;
const MAX_PAGES = 8;
const BOARD_SIZE = 100;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function createDatabases(): Databases {
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) client.setKey(apiKey);
  return new Databases(client);
}

function matchesRun(run: RunDocument, language: string, mode: TestMode, snippetLength: SnippetLength, durationSeconds: number): boolean {
  if (!run.verified || run.accuracy < MIN_RANKED_ACCURACY || run.wpm < MIN_RANKED_WPM) return false;
  if (language !== "All" && run.language !== language) return false;
  // "All" is every code language; text has its own boards.
  if (language === "All" && isTextLanguage(run.language)) return false;
  if (run.mode !== mode) return false;
  if (mode === "timed" && run.durationSeconds !== durationSeconds) return false;
  if (mode === "snippet") {
    const length = run.snippetLength ?? "medium";
    if (length !== snippetLength || !isWithinLengthSpec(length, run.targetChars)) return false;
  }
  return true;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return void res.status(200).json({ ok: true });
  if (req.method !== "GET") return void res.status(405).json({ error: "Method not allowed." });
  if (!projectId || !apiKey) return void res.status(503).json({ error: "Leaderboard service is not configured." });

  const language = first(req.query.language) || "All";
  const mode = (first(req.query.mode) === "timed" ? "timed" : "snippet") as TestMode;
  const requestedLength = first(req.query.snippetLength);
  const snippetLength = (["short", "medium", "long"].includes(requestedLength || "") ? requestedLength : "medium") as SnippetLength;
  const durationSeconds = Math.max(15, Number(first(req.query.durationSeconds)) || 30);
  const databases = createDatabases();

  try {
    const requestStartedAt = performance.now();
    // Most boards fit in the first 100 profiles. Starting this now removes the
    // runs -> profiles network waterfall; missing profiles are fetched below.
    const warmProfilesPromise = databases.listDocuments({
      databaseId,
      collectionId: profilesCollectionId,
      queries: [Query.limit(100)],
    });
    const runs: RunDocument[] = [];
    const seenUsers = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES && runs.length < BOARD_SIZE; page += 1) {
      const queries = [
        Query.equal("verified", true),
        Query.equal("mode", mode),
        Query.greaterThanEqual("accuracy", MIN_RANKED_ACCURACY),
        Query.orderDesc("wpm"),
        Query.limit(PAGE_SIZE),
      ];
      if (language !== "All") queries.push(Query.equal("language", language));
      if (mode === "snippet") queries.push(Query.equal("snippetLength", snippetLength));
      if (mode === "timed") queries.push(Query.equal("durationSeconds", durationSeconds));
      if (cursor) queries.push(Query.cursorAfter(cursor));

      const response = await databases.listDocuments({ databaseId, collectionId: runsCollectionId, queries });
      const documents = response.documents as unknown as RunDocument[];
      for (const run of documents) {
        if (seenUsers.has(run.userId) || !matchesRun(run, language, mode, snippetLength, durationSeconds)) continue;
        seenUsers.add(run.userId);
        runs.push(run);
        if (runs.length >= BOARD_SIZE) break;
      }
      if (documents.length < PAGE_SIZE) break;
      cursor = documents[documents.length - 1]?.$id;
      if (!cursor) break;
    }

    const profileIds = runs.map((run) => run.userId);
    const neededProfiles = new Set(profileIds);
    const warmProfiles = (await warmProfilesPromise).documents.filter((profile) => neededProfiles.has(profile.$id));
    const foundProfiles = new Set(warmProfiles.map((profile) => profile.$id));
    const missingProfileIds = profileIds.filter((id) => !foundProfiles.has(id));
    const fallbackProfiles = missingProfileIds.length === 0
      ? []
      : (await databases.listDocuments({
          databaseId,
          collectionId: profilesCollectionId,
          queries: [Query.equal("$id", missingProfileIds), Query.limit(missingProfileIds.length)],
        })).documents;
    const profiles = [...warmProfiles, ...fallbackProfiles];

    res.setHeader("Server-Timing", `appwrite;dur=${(performance.now() - requestStartedAt).toFixed(1)}`);
    res.status(200).json({ runs, profiles });
  } catch (error) {
    console.error("Leaderboard aggregation failed:", error);
    res.status(503).json({ error: "Leaderboard data could not be loaded." });
  }
}
