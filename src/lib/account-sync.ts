import { databases, appwriteConfig } from "./appwrite";
import { readAccountPrefs, updateAccountPrefs } from "./account-prefs";
import { getProfile, pullCloudRuns, syncLocalRuns } from "./cloud";
import { ensureHistoryIds, getStreak } from "@/utils/storage";

/**
 * Keeps a signed-in player's data the same on every device.
 *
 * Settings-like data lives in "slices" stored in the account prefs under
 * `sync`. Each sync compares this device, the account, and what both looked
 * like at the last sync: whichever side changed wins, and when both changed
 * the newer edit wins. Collections (duels, arcade scores) are merged.
 * Runs go to the runs collection and the streak to the public profile.
 */

type Json = unknown;

interface Slice {
  id: string;
  /** localStorage keys this slice reads; a write to any of them schedules a sync. */
  keys: string[];
  read(): Json;
  write(value: Json): void;
  /** Collections merge instead of last-write-wins. */
  merge?(local: Json, remote: Json): Json;
  /** Trim what is sent to the account (prefs have a size limit). */
  toRemote?(value: Json): Json;
}

const getJson = (key: string) => {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Json;
  } catch {
    return raw;
  }
};
const setJson = (key: string, value: Json) => {
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
};

/** A slice backed by one localStorage key, last write wins. */
const single = (id: string, key: string): Slice => ({ id, keys: [key], read: () => getJson(key), write: (value) => setJson(key, value) });

const ARCADE_SETS = ["home", "top", "code"];
const arcadeKey = (set: string) => `codey_arcade_high_score_v2_${set}`;

interface DuelEntry { id: string; timestamp: number }

export const SLICES: Slice[] = [
  single("preferences", "codetype-preferences"),
  single("theme", "codetype-theme"),
  single("settings", "codetype_settings"),
  single("radio", "codetype-flow-radio"),
  {
    id: "sound",
    keys: ["codey_soundpack_id_v1", "codey_sound_volume_v1"],
    read: () => {
      const pack = localStorage.getItem("codey_soundpack_id_v1");
      const volume = localStorage.getItem("codey_sound_volume_v1");
      return pack === null && volume === null ? null : { pack, volume };
    },
    write: (value) => {
      const { pack, volume } = (value ?? {}) as { pack?: string | null; volume?: string | null };
      if (pack) localStorage.setItem("codey_soundpack_id_v1", pack);
      if (volume) localStorage.setItem("codey_sound_volume_v1", volume);
    },
  },
  {
    id: "arcade",
    keys: ARCADE_SETS.map(arcadeKey),
    read: () => Object.fromEntries(ARCADE_SETS.map((set) => [set, Number(localStorage.getItem(arcadeKey(set))) || 0])),
    write: (value) => {
      for (const [set, score] of Object.entries((value ?? {}) as Record<string, number>)) {
        if (ARCADE_SETS.includes(set) && score > 0) localStorage.setItem(arcadeKey(set), String(score));
      }
    },
    // High scores only go up.
    merge: (local, remote) => {
      const a = (local ?? {}) as Record<string, number>;
      const b = (remote ?? {}) as Record<string, number>;
      return Object.fromEntries(ARCADE_SETS.map((set) => [set, Math.max(Number(a[set]) || 0, Number(b[set]) || 0)]));
    },
  },
  {
    id: "duels",
    keys: ["codey_duel_history_v1"],
    read: () => (getJson("codey_duel_history_v1") as DuelEntry[] | null) ?? [],
    write: (value) => setJson("codey_duel_history_v1", value),
    merge: (local, remote) => {
      const byId = new Map<string, DuelEntry>();
      for (const entry of [...((local as DuelEntry[]) ?? []), ...((remote as DuelEntry[]) ?? [])]) if (entry?.id) byId.set(entry.id, entry);
      return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    },
    toRemote: (value) => ((value as DuelEntry[]) ?? []).slice(0, 30),
  },
];

const TRACKED = new Map(SLICES.flatMap((slice) => slice.keys.map((key) => [key, slice.id] as const)));
const STREAK_KEY = "codetype_streak";
const HISTORY_KEY = "codetype_history";

/* ---- Local bookkeeping ---- */

const META_KEY = "codey_account_sync_v1";

interface Meta {
  userId: string | null;
  /** Serialized value of each slice as of the last sync, the common ancestor. */
  base: Record<string, string>;
  /** When this device last edited each slice. */
  changedAt: Record<string, number>;
  lastSyncAt: number | null;
}

const emptyMeta = (): Meta => ({ userId: null, base: {}, changedAt: {}, lastSyncAt: null });

function readMeta(): Meta {
  try {
    return { ...emptyMeta(), ...(JSON.parse(localStorage.getItem(META_KEY) ?? "null") ?? {}) };
  } catch {
    return emptyMeta();
  }
}

let applying = false;
function writeMeta(meta: Meta) {
  applying = true;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } finally {
    applying = false;
  }
}

/* ---- Merge rules (pure, tested) ---- */

export interface RemoteSlice { at: number; value: Json }

export type Decision = { action: "keep" } | { action: "push"; value: Json } | { action: "pull"; value: Json } | { action: "both"; value: Json };

/**
 * Three-way decision for one slice. `base` is the serialized value both
 * sides agreed on at the last sync (undefined on a device's first sync).
 */
export function decide(slice: Pick<Slice, "merge">, local: Json, remote: RemoteSlice | undefined, base: string | undefined, localChangedAt: number | undefined): Decision {
  const localText = JSON.stringify(local ?? null);
  if (!remote) return local === null || local === undefined ? { action: "keep" } : { action: "push", value: local };
  const remoteText = JSON.stringify(remote.value ?? null);
  if (localText === remoteText) return { action: "keep" };
  if (slice.merge) {
    const merged = slice.merge(local, remote.value);
    const mergedText = JSON.stringify(merged);
    if (mergedText === localText) return { action: "push", value: merged };
    if (mergedText === remoteText) return { action: "pull", value: merged };
    return { action: "both", value: merged };
  }
  const localChanged = base === undefined ? local !== null && localChangedAt !== undefined : localText !== base;
  const remoteChanged = base === undefined ? true : remoteText !== base;
  if (localChanged && !remoteChanged) return { action: "push", value: local };
  if (remoteChanged && !localChanged) return { action: "pull", value: remote.value };
  // Both sides edited since the last sync: the later edit wins.
  return (localChangedAt ?? 0) > remote.at ? { action: "push", value: local } : { action: "pull", value: remote.value };
}

export interface StreakValue { current: number; best: number; lastDate: string }

/** Streaks merge by best (max) and by whichever device practiced most recently. */
export function mergeStreak(local: StreakValue, remote: StreakValue): StreakValue {
  const best = Math.max(local.best, remote.best, local.current, remote.current);
  if (local.lastDate === remote.lastDate) return { current: Math.max(local.current, remote.current), best, lastDate: local.lastDate };
  const newer = (local.lastDate || "") > (remote.lastDate || "") ? local : remote;
  return { current: newer.current, best, lastDate: newer.lastDate };
}

/* ---- Sync ---- */

export const SYNC_EVENT = "codey:account-synced";
export type SyncState = { status: "idle" | "syncing" | "synced" | "error"; lastSyncAt: number | null; error?: string };

let state: SyncState = { status: "idle", lastSyncAt: readMeta().lastSyncAt };
const listeners = new Set<(state: SyncState) => void>();
const setState = (next: SyncState) => {
  state = next;
  for (const listener of listeners) listener(state);
};
export const getSyncState = () => state;
export function subscribeSyncState(listener: (state: SyncState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const localDateKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Streak: local file <-> public profile document. */
async function syncStreak(userId: string): Promise<boolean> {
  if (!databases) return false;
  const profile = await getProfile(userId);
  if (!profile) return false;
  const local = getStreak();
  const remote: StreakValue = { current: profile.currentStreak ?? 0, best: profile.bestStreak ?? 0, lastDate: profile.lastActiveDate ? localDateKey(profile.lastActiveDate) : "" };
  const merged = mergeStreak(local, remote);
  let pulled = false;
  if (JSON.stringify(merged) !== JSON.stringify({ current: local.current, best: local.best, lastDate: local.lastDate })) {
    applying = true;
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ ...local, ...merged }));
    } finally {
      applying = false;
    }
    pulled = true;
  }
  if (merged.current !== remote.current || merged.best !== remote.best || merged.lastDate !== remote.lastDate) {
    await databases.updateDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.profilesCollectionId,
      documentId: userId,
      data: {
        currentStreak: merged.current,
        bestStreak: merged.best,
        lastActiveDate: merged.lastDate ? new Date(`${merged.lastDate}T12:00:00`).toISOString() : null,
      },
    });
  }
  return pulled;
}

async function syncSlices(userId: string): Promise<string[]> {
  let meta = readMeta();
  if (meta.userId !== userId) meta = { ...emptyMeta(), userId };
  const prefs = (await readAccountPrefs()) ?? {};
  const remoteSlices = ((prefs.sync as { slices?: Record<string, RemoteSlice> } | undefined)?.slices ?? {}) as Record<string, RemoteSlice>;
  const pulled: string[] = [];
  const pushes: Record<string, RemoteSlice> = {};
  const now = Date.now();

  for (const slice of SLICES) {
    const local = slice.read();
    const decision = decide(slice, local, remoteSlices[slice.id], meta.base[slice.id], meta.changedAt[slice.id]);
    if (decision.action === "keep") {
      meta.base[slice.id] = JSON.stringify(local ?? null);
      continue;
    }
    if (decision.action === "pull" || decision.action === "both") {
      applying = true;
      try {
        slice.write(decision.value);
      } finally {
        applying = false;
      }
      pulled.push(slice.id);
    }
    if (decision.action === "push" || decision.action === "both") {
      const value = slice.toRemote ? slice.toRemote(decision.value) : decision.value;
      pushes[slice.id] = { at: meta.changedAt[slice.id] ?? now, value };
    }
    meta.base[slice.id] = JSON.stringify(slice.read() ?? null);
  }

  if (Object.keys(pushes).length) {
    await updateAccountPrefs((latest) => {
      const current = ((latest.sync as { slices?: Record<string, RemoteSlice> } | undefined)?.slices ?? {}) as Record<string, RemoteSlice>;
      return { ...latest, sync: { v: 1, slices: { ...current, ...pushes } } };
    });
  }
  meta.lastSyncAt = now;
  writeMeta(meta);
  return pulled;
}

let running: Promise<void> | null = null;

/**
 * One full sync. `full` also moves runs both ways (heavier; on sign-in and
 * when the tab comes back); a quick sync only handles slices and the streak.
 */
export function syncAccount(userId: string, { full = true } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    setState({ ...state, status: "syncing" });
    try {
      const pulled = await syncSlices(userId);
      if (await syncStreak(userId).catch(() => false)) pulled.push("streak");
      if (full) {
        await syncLocalRuns(userId, ensureHistoryIds());
        if ((await pullCloudRuns(userId).catch(() => 0)) > 0) pulled.push("history");
      }
      setState({ status: "synced", lastSyncAt: Date.now() });
      if (pulled.length) window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: pulled }));
    } catch (error) {
      console.warn("Account sync failed", error);
      setState({ status: "error", lastSyncAt: state.lastSyncAt, error: error instanceof Error ? error.message : "Sync failed" });
    } finally {
      running = null;
    }
  })();
  return running;
}

/* ---- Wiring ---- */

let activeUser: string | null = null;
let quickTimer: ReturnType<typeof setTimeout> | null = null;
let patched = false;

function onLocalWrite(key: string) {
  if (applying || !activeUser) return;
  const sliceId = TRACKED.get(key);
  if (!sliceId && key !== STREAK_KEY && key !== HISTORY_KEY) return;
  if (sliceId) {
    const meta = readMeta();
    meta.changedAt[sliceId] = Date.now();
    writeMeta(meta);
  }
  if (quickTimer) clearTimeout(quickTimer);
  const user = activeUser;
  // New runs are uploaded by the app itself; slices and the streak follow shortly after edits.
  quickTimer = setTimeout(() => void syncAccount(user, { full: false }), 3000);
}

/** Watch this tab's writes to synced keys so edits reach the account without each feature knowing about sync. */
function patchStorage() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(this: Storage, key: string, value: string) {
    original.call(this, key, value);
    if (this === window.localStorage) onLocalWrite(key);
  };
}

function onVisible() {
  if (document.visibilityState !== "visible" || !activeUser) return;
  if (Date.now() - (state.lastSyncAt ?? 0) > 60_000) void syncAccount(activeUser);
}

/** Start syncing for a signed-in player; call with null on sign-out. */
export function startAccountSync(userId: string | null) {
  activeUser = userId;
  if (!userId) {
    document.removeEventListener("visibilitychange", onVisible);
    setState({ status: "idle", lastSyncAt: null });
    return;
  }
  patchStorage();
  document.addEventListener("visibilitychange", onVisible);
  void syncAccount(userId);
}
