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
import { Client, Databases, DatabasesIndexType, OrderBy, Permission, Role } from "node-appwrite";

const env = process.env;
const endpoint = env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const apiKey = env.APPWRITE_API_KEY;
const databaseId = env.VITE_APPWRITE_DATABASE_ID || "codetype";
const ids = {
  dailyChallenges: env.VITE_APPWRITE_DAILY_CHALLENGES_COLLECTION_ID || "daily_challenges",
  dailyRuns: env.VITE_APPWRITE_DAILY_RUNS_COLLECTION_ID || "daily_runs",
  runSessions: env.VITE_APPWRITE_RUN_SESSIONS_COLLECTION_ID || "run_sessions",
};

if (!projectId || !apiKey) {
  console.error("Missing VITE_APPWRITE_PROJECT_ID or APPWRITE_API_KEY. Put them in .env and run:\n  node --env-file=.env scripts/setup-appwrite-daily.mjs");
  process.exit(1);
}

const databases = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
const isNotFound = (error) => error?.code === 404;

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

async function ensureDatabase() {
  try {
    await databases.get({ databaseId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    console.error(`Database "${databaseId}" does not exist. Create it first (see appwrite/README.md).`);
    process.exit(1);
  }
}

async function ensureCollection(spec) {
  try {
    await databases.getCollection({ databaseId, collectionId: spec.id });
    console.log(`✓ collection ${spec.id} exists`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    // Public read, no client writes: only the server API key writes documents.
    await databases.createCollection({
      databaseId,
      collectionId: spec.id,
      name: spec.name,
      permissions: [Permission.read(Role.any())],
      documentSecurity: false,
    });
    console.log(`+ created collection ${spec.id}`);
  }
}

async function ensureAttribute(collectionId, attribute) {
  try {
    await databases.getAttribute({ databaseId, collectionId, key: attribute.key });
    return false;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  const base = { databaseId, collectionId, key: attribute.key, required: attribute.required };
  if (attribute.type === "string") await databases.createStringAttribute({ ...base, size: attribute.size });
  else if (attribute.type === "float") await databases.createFloatAttribute(base);
  else if (attribute.type === "integer") await databases.createIntegerAttribute(base);
  else if (attribute.type === "datetime") await databases.createDatetimeAttribute(base);
  console.log(`  + ${collectionId}.${attribute.key} (${attribute.type})`);
  return true;
}

/** Attributes build asynchronously; indexes can only use available ones. */
async function waitForAttributes(collectionId, keys) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { attributes } = await databases.listAttributes({ databaseId, collectionId });
    const pending = attributes.filter((attribute) => keys.includes(attribute.key) && attribute.status !== "available");
    const failed = pending.filter((attribute) => attribute.status === "failed");
    if (failed.length) throw new Error(`Attribute build failed: ${failed.map((a) => a.key).join(", ")}`);
    if (!pending.length) return;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for attributes: ${pending.map((a) => a.key).join(", ")}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function ensureIndex(collectionId, index) {
  const { indexes } = await databases.listIndexes({ databaseId, collectionId });
  if (indexes.some((existing) => existing.key === index.key)) return;
  await databases.createIndex({ databaseId, collectionId, type: DatabasesIndexType.Key, ...index });
  console.log(`  + index ${collectionId}.${index.key}`);
}

async function main() {
  console.log(`Appwrite ${endpoint} · project ${projectId} · database ${databaseId}\n`);
  await ensureDatabase();

  try {
    await databases.getCollection({ databaseId, collectionId: ids.runSessions });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    console.warn(`! collection ${ids.runSessions} is missing. Daily attempts reuse it; create it from appwrite/schema.md.`);
  }

  for (const spec of SCHEMA) {
    await ensureCollection(spec);
    for (const attribute of spec.attributes) await ensureAttribute(spec.id, attribute);
    if (spec.indexes.length) {
      await waitForAttributes(spec.id, spec.attributes.map((attribute) => attribute.key));
      for (const index of spec.indexes) await ensureIndex(spec.id, index);
    }
  }
  console.log("\nDone. The next visit to the site picks today's challenge from GitHub.");
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error?.message ?? error}`);
  if (error?.code === 401) console.error("The API key is missing a scope. It needs databases, collections, attributes and indexes (read + write).");
  process.exit(1);
});
