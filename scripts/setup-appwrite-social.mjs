#!/usr/bin/env node
/**
 * Collections behind weekly leagues, friends and push notifications
 * (see appwrite/schema.md). Only the server API key reads or writes them;
 * the app goes through /api/social and /api/push. Safe to re-run.
 *
 *   node --env-file=.env scripts/setup-appwrite-social.mjs
 *
 * Needs VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID and APPWRITE_API_KEY
 * (a server key with databases, collections, attributes and indexes scopes).
 * The API key used by Vercel also needs the users.read scope, for share cards.
 */
import { OrderBy } from "node-appwrite";
import { applySchema, connect, fail } from "./lib/appwrite-setup.mjs";

const env = process.env;
const serverOnly = { permissions: [], documentSecurity: false };

const SCHEMA = [
  {
    id: env.VITE_APPWRITE_LEAGUE_PLAYERS_COLLECTION_ID || "league_players",
    name: "League players",
    ...serverOnly,
    attributes: [
      { type: "integer", key: "division", required: false },
      { type: "string", key: "week", size: 10, required: false },
      { type: "string", key: "groupId", size: 36, required: false },
      { type: "string", key: "lastWeek", size: 10, required: false },
      { type: "string", key: "lastResult", size: 8, required: false },
      { type: "integer", key: "lastRank", required: false },
      { type: "integer", key: "lastDivision", required: false },
      { type: "integer", key: "bestDivision", required: false },
      { type: "string", key: "xpDate", size: 10, required: false },
      { type: "integer", key: "xpToday", required: false },
    ],
    indexes: [],
  },
  {
    id: env.VITE_APPWRITE_LEAGUE_GROUPS_COLLECTION_ID || "league_groups",
    name: "League groups",
    ...serverOnly,
    attributes: [
      { type: "string", key: "week", size: 10, required: true },
      { type: "integer", key: "division", required: true },
      { type: "integer", key: "number", required: true },
      { type: "integer", key: "size", required: true },
    ],
    indexes: [{ key: "by_week_division", attributes: ["week", "division", "size", "number"], orders: [OrderBy.Asc, OrderBy.Asc, OrderBy.Asc, OrderBy.Asc] }],
  },
  {
    id: env.VITE_APPWRITE_LEAGUE_MEMBERS_COLLECTION_ID || "league_members",
    name: "League members",
    ...serverOnly,
    attributes: [
      { type: "string", key: "week", size: 10, required: true },
      { type: "string", key: "groupId", size: 36, required: true },
      { type: "string", key: "userId", size: 36, required: true },
      { type: "integer", key: "division", required: true },
      { type: "integer", key: "xp", required: true },
      { type: "string", key: "name", size: 64, required: false },
      { type: "string", key: "username", size: 100, required: false },
      { type: "string", key: "avatarUrl", size: 500, required: false },
    ],
    indexes: [
      { key: "by_group_xp", attributes: ["groupId", "xp"], orders: [OrderBy.Asc, OrderBy.Desc] },
      { key: "by_user", attributes: ["userId"], orders: [OrderBy.Asc] },
    ],
  },
  {
    id: env.VITE_APPWRITE_LEAGUE_XP_COLLECTION_ID || "league_xp",
    name: "League XP (one per counted run)",
    ...serverOnly,
    attributes: [
      { type: "string", key: "userId", size: 36, required: true },
      { type: "string", key: "week", size: 10, required: true },
      { type: "integer", key: "xp", required: true },
    ],
    indexes: [],
  },
  {
    id: env.VITE_APPWRITE_FOLLOWS_COLLECTION_ID || "follows",
    name: "Follows",
    ...serverOnly,
    attributes: [
      { type: "string", key: "followerId", size: 36, required: true },
      { type: "string", key: "followeeId", size: 36, required: true },
    ],
    indexes: [
      { key: "by_follower", attributes: ["followerId"], orders: [OrderBy.Asc] },
      { key: "by_followee", attributes: ["followeeId"], orders: [OrderBy.Asc] },
    ],
  },
  {
    id: env.VITE_APPWRITE_PUSH_COLLECTION_ID || "push_subscriptions",
    name: "Push subscriptions",
    ...serverOnly,
    attributes: [
      { type: "string", key: "userId", size: 36, required: true },
      { type: "string", key: "endpoint", size: 1000, required: true },
      { type: "string", key: "p256dh", size: 200, required: true },
      { type: "string", key: "auth", size: 100, required: true },
      { type: "boolean", key: "streak", required: false },
      { type: "boolean", key: "league", required: false },
      { type: "integer", key: "tzOffset", required: false },
    ],
    indexes: [
      { key: "by_user", attributes: ["userId"], orders: [OrderBy.Asc] },
      { key: "by_streak", attributes: ["streak"], orders: [OrderBy.Asc] },
    ],
  },
  // Friend search looks players up by the start of their name.
  {
    id: env.VITE_APPWRITE_PROFILES_COLLECTION_ID || "profiles",
    name: "Profiles",
    attributes: [{ type: "string", key: "displayName", size: 100, required: false }],
    indexes: [{ key: "by_display_name", attributes: ["displayName"], orders: [OrderBy.Asc] }],
  },
];

applySchema(connect("scripts/setup-appwrite-social.mjs"), SCHEMA)
  .then(() => console.log("\nDone. Leagues, friends and push notifications are ready."))
  .catch(fail);
