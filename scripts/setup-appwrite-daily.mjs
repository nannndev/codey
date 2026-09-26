#!/usr/bin/env node
/**
 * Creates the Appwrite collections the daily challenge needs:
 * `daily_challenges` and `daily_runs` (see appwrite/schema.md).
 *
 * Safe to re-run: existing collections, attributes and indexes are kept.
 *
 *   node --env-file=.env scripts/setup-appwrite-daily.mjs
 *
 * Needs VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID and APPWRITE_API_KEY
 * (a server key with databases, collections, attributes and indexes scopes).
 */
import { OrderBy } from "node-appwrite";
import { applySchema, connect, databaseId, fail, isNotFound } from "./lib/appwrite-setup.mjs";

const env = process.env;
const ids = {
  dailyChallenges: env.VITE_APPWRITE_DAILY_CHALLENGES_COLLECTION_ID || "daily_challenges",
  dailyRuns: env.VITE_APPWRITE_DAILY_RUNS_COLLECTION_ID || "daily_runs",
  runSessions: env.VITE_APPWRITE_RUN_SESSIONS_COLLECTION_ID || "run_sessions",
};

const databases = connect("scripts/setup-appwrite-daily.mjs");

/** Collections, attributes and indexes, matching appwrite/schema.md. */
const SCHEMA = [
  {
    id: ids.dailyChallenges,
    name: "Daily challenges",
    attributes: [
      { type: "string", key: "date", size: 10, required: true },
      { type: "string", key: "language", size: 64, required: true },
      { type: "string", key: "code", size: 4000, required: true },
      { type: "string", key: "filename", size: 255, required: true },
      { type: "string", key: "sourceRepo", size: 255, required: true },
      { type: "string", key: "sourceUrl", size: 512, required: true },
    ],
    indexes: [],
  },
  {
    id: ids.dailyRuns,
    name: "Daily runs",
    attributes: [
      { type: "string", key: "date", size: 10, required: true },
      { type: "string", key: "userId", size: 36, required: true },
      { type: "string", key: "language", size: 64, required: true },
      { type: "float", key: "wpm", required: true },
      { type: "float", key: "rawWpm", required: true },
      { type: "float", key: "accuracy", required: true },
      { type: "integer", key: "durationMs", required: true },
      { type: "integer", key: "mistakes", required: true },
      { type: "integer", key: "keystrokes", required: true },
      // Appwrite does not allow a default on a required attribute; the API always sets it.
      { type: "integer", key: "attempts", required: true },
      { type: "datetime", key: "bestAt", required: true },
    ],
    indexes: [
      { key: "date_wpm", attributes: ["date", "wpm"], orders: [OrderBy.Asc, OrderBy.Desc] },
      { key: "user_date", attributes: ["userId", "date"], orders: [OrderBy.Asc, OrderBy.Desc] },
    ],
  },
];

async function main() {
  try {
    await databases.getCollection({ databaseId, collectionId: ids.runSessions });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    console.warn(`! collection ${ids.runSessions} is missing. Daily attempts reuse it; create it from appwrite/schema.md.`);
  }
  await applySchema(databases, SCHEMA);
  console.log("\nDone. The next visit to the site picks today's challenge from GitHub.");
}

main().catch(fail);
