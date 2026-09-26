#!/usr/bin/env node
/**
 * Creates the `challenges` collection behind "Challenge a friend" links
 * (see appwrite/schema.md). Anyone can read a challenge; signed-in players
 * can create one; nobody can edit one afterwards. Safe to re-run.
 *
 *   node --env-file=.env scripts/setup-appwrite-challenges.mjs
 *
 * Needs VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID and APPWRITE_API_KEY
 * (a server key with databases, collections, attributes and indexes scopes).
 */
import { OrderBy, Permission, Role } from "node-appwrite";
import { applySchema, connect, fail } from "./lib/appwrite-setup.mjs";

const SCHEMA = [
  {
    id: process.env.VITE_APPWRITE_CHALLENGES_COLLECTION_ID || "challenges",
    name: "Challenges",
    permissions: [Permission.read(Role.any()), Permission.create(Role.users())],
    documentSecurity: false,
    attributes: [
      { type: "string", key: "userId", size: 36, required: true },
      { type: "string", key: "name", size: 64, required: true },
      { type: "string", key: "username", size: 64, required: false },
      { type: "string", key: "language", size: 64, required: true },
      { type: "string", key: "code", size: 16000, required: true },
      { type: "string", key: "filename", size: 256, required: false },
      { type: "string", key: "sourceRepo", size: 200, required: false },
      { type: "string", key: "sourceUrl", size: 500, required: false },
      { type: "float", key: "wpm", required: true },
      { type: "float", key: "accuracy", required: true },
    ],
    indexes: [{ key: "by_user", attributes: ["userId"], orders: [OrderBy.Asc] }],
  },
];

applySchema(connect("scripts/setup-appwrite-challenges.mjs"), SCHEMA)
  .then(() => console.log("\nDone. Challenge links are ready."))
  .catch(fail);
