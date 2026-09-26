#!/usr/bin/env node
/**
 * Adds the optional `speedTrace` attribute to the runs collection, used to
 * draw the speed bars on share cards (see appwrite/schema.md). Safe to re-run.
 *
 *   node --env-file=.env scripts/setup-appwrite-share.mjs
 *
 * Needs VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID and APPWRITE_API_KEY
 * (a server key with databases, collections and attributes scopes).
 */
import { applySchema, connect, fail } from "./lib/appwrite-setup.mjs";

const SCHEMA = [
  {
    id: process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || "runs",
    name: "Runs",
    attributes: [{ type: "string", key: "speedTrace", size: 400, required: false }],
    indexes: [],
  },
];

applySchema(connect("scripts/setup-appwrite-share.mjs"), SCHEMA)
  .then(() => console.log("\nDone. New runs will carry a speed trace for share cards."))
  .catch(fail);
