import { Query } from "appwrite";
import { getHistory, getStreak } from "@/utils/storage";
import { getDuelHistory } from "@/utils/duel-history";
import { getVisibleKeyStats } from "@/utils/keyboard-analytics";
import {
  mergeIntoStore,
  parseAccountAchievements,
  readStore,
  syncAchievements,
  toAccountAchievements,
  writeStore,
  type AchievementSnapshot,
  type SnapshotRun,
} from "./achievements";
import { streakFromRuns } from "./run-stats";
import { account, appwriteConfig, databases } from "./appwrite";
import { updateAccountPrefs } from "./account-prefs";
import { getProfile, listUserRuns, type CloudRun } from "./cloud";
import { getCloudKeyboardStats } from "./keyboard-stats-cloud";

/**
 * Achievements follow the account: a snapshot merges this device's history
 * with what the cloud knows (runs from every device, verified Ranked and
 * Daily results, keyboard totals), and unlock dates plus duel wins are kept
 * in the account's prefs so every device agrees.
 */

type SnapshotSource = SnapshotRun & { key: string };

const runKey = (language: string, mode: string, wpm: number, accuracy: number) => `${language}|${mode}|${wpm.toFixed(1)}|${accuracy.toFixed(1)}`;

function fromCloud(run: CloudRun): SnapshotSource {
  return {
    key: runKey(run.language, run.mode, run.wpm, run.accuracy),
    timestamp: new Date(run.$createdAt).getTime(),
    wpm: run.wpm,
    accuracy: run.accuracy,
    language: run.language,
    duration: run.mode === "timed" && run.durationSeconds ? run.durationSeconds * 1000 : run.durationMs,
    charsTyped: run.keystrokes,
  };
}

function localRuns(): SnapshotSource[] {
  return getHistory().map((run) => ({
    key: runKey(run.language, run.mode, run.wpm, run.accuracy),
    timestamp: run.timestamp,
    wpm: run.wpm,
    accuracy: run.accuracy,
    language: run.language,
    duration: run.duration,
    charsTyped: run.charsTyped,
    maxCombo: run.maxCombo,
  }));
}

/** Local runs win on conflicts: they carry combos and the real finish time. */
function mergeRuns(local: SnapshotSource[], cloud: SnapshotSource[]): SnapshotRun[] {
  const seen = new Set(local.map((run) => run.key));
  return [...local, ...cloud.filter((run) => !seen.has(run.key))];
}

interface CloudExtras {
  runs: SnapshotSource[];
  verifiedRuns: number;
  dailyRuns: number;
  keystrokes: number;
  bestStreak: number;
}

/** Latest cloud data per user, so checks right after a run need no network. */
const extrasCache = new Map<string, CloudExtras>();

function localDuelWins() {
  const wins = getDuelHistory().filter((duel) => duel.outcome === "victory");
  return { all: wins.map((duel) => duel.id), party: wins.filter((duel) => (duel.playerCount ?? 2) >= 4).map((duel) => duel.id) };
}

/** Everything known about the signed-in player (or a guest): this device plus the cached cloud data. */
export function localSnapshot(userId?: string | null): AchievementSnapshot {
  const extras = userId ? extrasCache.get(userId) : undefined;
  const runs = mergeRuns(localRuns(), extras?.runs ?? []);
  const store = readStore();
  const duels = localDuelWins();
  const localKeys = Object.values(getVisibleKeyStats(userId)).reduce((sum, stat) => sum + (stat.totalPresses || 0), 0);
  return {
    runs,
    bestStreak: Math.max(getStreak().best, streakFromRuns(runs).best, extras?.bestStreak ?? 0),
    keystrokes: Math.max(localKeys, extras?.keystrokes ?? 0),
    duelWins: new Set([...duels.all, ...store.syncedDuelWins]).size,
    partyWins: new Set([...duels.party, ...store.syncedPartyWins]).size,
    dailyCompleted: Math.max(store.dailyDates.length, extras?.dailyRuns ?? 0),
    rankedVerified: Math.max(store.rankedSessions.length, extras?.verifiedRuns ?? 0),
  };
}

/** Daily Challenge days a player has a verified score for (the board is public). */
async function countDailyRuns(userId: string): Promise<number> {
  if (!databases) return 0;
  try {
    const result = await databases.listDocuments({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.dailyRunsCollectionId,
      queries: [Query.equal("userId", userId), Query.limit(1)],
    });
    return result.total;
  } catch {
    return 0;
  }
}

/** Another player's badges, from data the server verified. Duel and keyboard badges are self-reported, so they are left out. */
export async function publicSnapshot(userId: string, runs: CloudRun[]): Promise<AchievementSnapshot> {
  const mapped = runs.map(fromCloud);
  const [daily, profile] = await Promise.all([countDailyRuns(userId), getProfile(userId).catch(() => null)]);
  return {
    runs: mapped,
    bestStreak: Math.max(streakFromRuns(mapped).best, profile?.bestStreak ?? 0),
    keystrokes: null,
    duelWins: null,
    partyWins: null,
    dailyCompleted: daily,
    rankedVerified: runs.filter((run) => run.verified).length,
  };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushed = "";

/** Writes this device's record into the account prefs, keeping every other pref. */
async function pushToAccount() {
  if (!account) return;
  const duels = localDuelWins();
  const payload = toAccountAchievements(readStore(), duels.all, duels.party);
  const serialized = JSON.stringify(payload);
  if (serialized === lastPushed) return;
  await updateAccountPrefs((prefs) => (JSON.stringify(prefs.achievements) === serialized ? null : { ...prefs, achievements: payload }));
  lastPushed = serialized;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushToAccount().catch((error) => console.warn("Achievements could not be saved to the account", error));
  }, 1500);
}

/**
 * Full sync for a signed-in player: pull the account's record and the cloud
 * data, merge, announce anything newly earned, and push the merged record back.
 * Badges earned on another device arrive silently.
 */
const inFlight = new Map<string, Promise<ReturnType<typeof syncAchievements>>>();

export function syncAchievementsForAccount(userId: string) {
  const running = inFlight.get(userId);
  if (running) return running;
  const sync = runAccountSync(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, sync);
  return sync;
}

async function runAccountSync(userId: string) {
  if (!account) return [];
  try {
    const [me, cloudRuns, cloudKeys, dailyRuns, profile] = await Promise.all([
      account.get(),
      listUserRuns(userId).catch(() => [] as CloudRun[]),
      getCloudKeyboardStats().catch(() => null),
      countDailyRuns(userId),
      getProfile(userId).catch(() => null),
    ]);
    const runs = cloudRuns.map(fromCloud);
    extrasCache.set(userId, {
      runs,
      verifiedRuns: cloudRuns.filter((run) => run.verified).length,
      dailyRuns,
      keystrokes: cloudKeys ? Object.values(cloudKeys).reduce((sum, stat) => sum + (stat.totalPresses || 0), 0) : 0,
      bestStreak: profile?.bestStreak ?? 0,
    });
    const remote = parseAccountAchievements((me.prefs as Record<string, unknown>).achievements);
    if (remote) writeStore(mergeIntoStore(readStore(), remote));
    // A sync only brings in progress made elsewhere, so it records without announcing.
    const fresh = syncAchievements(localSnapshot(userId), Date.now(), { silent: true });
    await pushToAccount();
    return fresh;
  } catch (error) {
    console.warn("Achievements sync failed", error);
    return [];
  }
}

/** Re-evaluate after anything that can earn a badge; announces new ones and saves them to the account. */
export function checkAchievements(userId?: string | null) {
  try {
    const fresh = syncAchievements(localSnapshot(userId));
    if (userId) schedulePush();
    return fresh;
  } catch (error) {
    console.warn("Achievements check failed", error);
    return [];
  }
}
