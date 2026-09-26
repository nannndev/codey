#!/usr/bin/env node
/**
 * Creates the Appwrite collection behind public duel rooms: `duel_rooms`
 * (see appwrite/schema.md). Safe to re-run.
 *
 *   node --env-file=.env scripts/setup-appwrite-duel.mjs
 *
 * Needs VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID and APPWRITE_API_KEY
 * (a server key with databases, collections, attributes and indexes scopes).
 */
import { OrderBy } from "node-appwrite";
import { applySchema, connect, fail } from "./lib/appwrite-setup.mjs";

const SCHEMA = [
  {
    id: process.env.VITE_APPWRITE_DUEL_ROOMS_COLLECTION_ID || "duel_rooms",
    name: "Duel rooms",
    attributes: [
      { type: "string", key: "code", size: 12, required: true },
      { type: "string", key: "hostId", size: 36, required: true },
      { type: "string", key: "hostName", size: 64, required: true },
      { type: "string", key: "language", size: 64, required: true },
      { type: "string", key: "mode", size: 16, required: true },
      { type: "string", key: "detail", size: 32, required: true },
      { type: "integer", key: "players", required: true },
      { type: "integer", key: "maxPlayers", required: true },
      { type: "string", key: "status", size: 16, required: true },
      { type: "boolean", key: "custom", required: true },
      { type: "datetime", key: "heartbeatAt", required: true },
    ],
    indexes: [
      { key: "heartbeat", attributes: ["heartbeatAt"], orders: [OrderBy.Desc] },
      { key: "host", attributes: ["hostId"], orders: [OrderBy.Asc] },
    ],
  },
];

applySchema(connect("scripts/setup-appwrite-duel.mjs"), SCHEMA)
  .then(() => console.log("\nDone. Public duel rooms are ready."))
  .catch(fail);
