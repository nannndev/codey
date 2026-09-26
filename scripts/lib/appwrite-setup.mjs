/**
 * Shared helpers for the Appwrite setup scripts: idempotently create
 * collections, attributes and indexes from a small schema description.
 */
import { Client, Databases, DatabasesIndexType, Permission, Role } from "node-appwrite";

const env = process.env;
export const endpoint = env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
export const projectId = env.VITE_APPWRITE_PROJECT_ID;
const apiKey = env.APPWRITE_API_KEY;
export const databaseId = env.VITE_APPWRITE_DATABASE_ID || "codetype";

export function connect(scriptPath) {
  if (!projectId || !apiKey) {
    console.error(`Missing VITE_APPWRITE_PROJECT_ID or APPWRITE_API_KEY. Put them in .env and run:\n  node --env-file=.env ${scriptPath}`);
    process.exit(1);
  }
  return new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
}

export const isNotFound = (error) => error?.code === 404;

let databases;

export async function ensureDatabase() {
  try {
    await databases.get({ databaseId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    console.error(`Database "${databaseId}" does not exist. Create it first (see appwrite/README.md).`);
    process.exit(1);
  }
}

export async function ensureCollection(spec) {
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

export async function ensureAttribute(collectionId, attribute) {
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
  else if (attribute.type === "boolean") await databases.createBooleanAttribute(base);
  console.log(`  + ${collectionId}.${attribute.key} (${attribute.type})`);
  return true;
}

/** Attributes build asynchronously; indexes can only use available ones. */
export async function waitForAttributes(collectionId, keys) {
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

export async function ensureIndex(collectionId, index) {
  const { indexes } = await databases.listIndexes({ databaseId, collectionId });
  if (indexes.some((existing) => existing.key === index.key)) return;
  await databases.createIndex({ databaseId, collectionId, type: DatabasesIndexType.Key, ...index });
  console.log(`  + index ${collectionId}.${index.key}`);
}


/** Applies every collection in `schema`, then waits for attributes before adding indexes. */
export async function applySchema(db, schema) {
  databases = db;
  console.log(`Appwrite ${endpoint} · project ${projectId} · database ${databaseId}\n`);
  await ensureDatabase();
  for (const spec of schema) {
    await ensureCollection(spec);
    for (const attribute of spec.attributes) await ensureAttribute(spec.id, attribute);
    if (spec.indexes.length) {
      await waitForAttributes(spec.id, spec.attributes.map((attribute) => attribute.key));
      for (const index of spec.indexes) await ensureIndex(spec.id, index);
    }
  }
}

export function fail(error) {
  console.error(`\nSetup failed: ${error?.message ?? error}`);
  if (error?.code === 401) console.error("The API key is missing a scope. It needs databases, collections, attributes and indexes (read + write).");
  process.exit(1);
}
