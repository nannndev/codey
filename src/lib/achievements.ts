/**
 * Achievements: tiered families (Bronze → Diamond) plus a few one-off feats.
 * Everything is derived from data the app already keeps; the only extra
 * state is when each badge was first earned and two small counters.
 */

export type Tier = 1 | 2 | 3 | 4;
export const TIER_NAMES: Record<Tier, string> = { 1: "Bronze", 2: "Silver", 3: "Gold", 4: "Diamond" };
export const TIER_NUMERALS: Record<Tier, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export interface SnapshotRun {
  timestamp: number;
  wpm: number;
  accuracy: number;
  language: string;
  duration: number;
  charsTyped: number;
  maxCombo?: number;
}

/** Everything the rules look at. Unknown sources are null so their badges are hidden, not shown as zero. */
export interface AchievementSnapshot {
  runs: SnapshotRun[];
  bestStreak: number;
  keystrokes: number | null;
  duelWins: number | null;
  /** Wins in rooms of four or more racers. */
  partyWins: number | null;
  dailyCompleted: number | null;
  rankedVerified: number | null;
}

export type FamilyId = "speed" | "precision" | "streak" | "runs" | "polyglot" | "time" | "keys" | "combo" | "duel" | "daily" | "ranked";
export type SingleId = "flawless" | "party" | "night-owl" | "early-bird";

export interface Family {
  id: FamilyId;
  name: string;
  /** Sentence for one tier's goal, e.g. "Hit 75 WPM in a run". */
  goal: (target: number) => string;
  unit: string;
  tiers: [number, number, number, number];
  metric: (snapshot: AchievementSnapshot) => number | null;
}

export interface Single {
  id: SingleId;
  name: string;
  goal: string;
  test: (snapshot: AchievementSnapshot) => boolean | null;
}

const hourOf = (timestamp: number) => new Date(timestamp).getHours();
const compact = (value: number) => (value >= 1_000_000 ? `${value / 1_000_000}M` : value >= 1000 ? `${value / 1000}k` : `${value}`);

export const FAMILIES: Family[] = [
  { id: "speed", name: "Velocity", unit: "wpm", tiers: [50, 75, 100, 125], goal: (t) => `Hit ${t} WPM in a run`, metric: (s) => Math.max(0, ...s.runs.map((run) => run.wpm)) },
  { id: "precision", name: "Precision", unit: "runs", tiers: [5, 25, 75, 200], goal: (t) => `Finish ${t} runs at 98% accuracy or better`, metric: (s) => s.runs.filter((run) => run.accuracy >= 98).length },
  { id: "streak", name: "On Fire", unit: "days", tiers: [3, 7, 14, 30], goal: (t) => `Practice ${t} days in a row`, metric: (s) => s.bestStreak },
  { id: "runs", name: "Dedicated", unit: "runs", tiers: [10, 50, 200, 500], goal: (t) => `Complete ${t} runs`, metric: (s) => s.runs.length },
  { id: "polyglot", name: "Polyglot", unit: "languages", tiers: [3, 6, 10, 15], goal: (t) => `Type in ${t} languages`, metric: (s) => new Set(s.runs.map((run) => run.language)).size },
  { id: "time", name: "Marathon", unit: "min", tiers: [30, 120, 600, 1500], goal: (t) => (t >= 120 ? `Type for ${t / 60} hours in total` : `Type for ${t} minutes in total`), metric: (s) => Math.floor(s.runs.reduce((sum, run) => sum + run.duration, 0) / 60_000) },
  { id: "keys", name: "Keysmith", unit: "keys", tiers: [10_000, 50_000, 250_000, 1_000_000], goal: (t) => `Press ${compact(t)} keys`, metric: (s) => s.keystrokes },
  { id: "combo", name: "Combo", unit: "combo", tiers: [50, 100, 200, 400], goal: (t) => `Reach a ${t}-key combo without a mistake`, metric: (s) => Math.max(0, ...s.runs.map((run) => run.maxCombo ?? 0)) },
  { id: "duel", name: "Duelist", unit: "wins", tiers: [1, 10, 25, 50], goal: (t) => (t === 1 ? "Win a duel" : `Win ${t} duels`), metric: (s) => s.duelWins },
  { id: "daily", name: "Daily Grind", unit: "days", tiers: [1, 5, 15, 30], goal: (t) => (t === 1 ? "Finish a Daily Challenge" : `Finish ${t} Daily Challenges`), metric: (s) => s.dailyCompleted },
  { id: "ranked", name: "Verified", unit: "runs", tiers: [1, 10, 50, 150], goal: (t) => (t === 1 ? "Get a Ranked run verified" : `Get ${t} Ranked runs verified`), metric: (s) => s.rankedVerified },
];

export const SINGLES: Single[] = [
  { id: "flawless", name: "Flawless", goal: "100% accuracy on a run of 150+ characters", test: (s) => s.runs.some((run) => run.accuracy >= 100 && run.charsTyped >= 150) },
  { id: "party", name: "Party Crasher", goal: "Win a duel room with four or more racers", test: (s) => (s.partyWins === null ? null : s.partyWins > 0) },
  { id: "night-owl", name: "Night Owl", goal: "Finish a run between midnight and 5 am", test: (s) => s.runs.some((run) => hourOf(run.timestamp) < 5) },
  { id: "early-bird", name: "Early Bird", goal: "Finish a run between 5 and 7 am", test: (s) => s.runs.some((run) => hourOf(run.timestamp) >= 5 && hourOf(run.timestamp) < 7) },
];

export const achievementId = (family: FamilyId, tier: Tier) => `${family}-${tier}`;
export const TOTAL_ACHIEVEMENTS = FAMILIES.length * 4 + SINGLES.length;

export interface FamilyProgress {
  family: Family;
  value: number;
  /** Highest tier reached; 0 when none. */
  tier: 0 | Tier;
  /** Next tier's target, or null when Diamond is done. */
  next: number | null;
  /** 0-1 towards the next tier (from the previous one). */
  progress: number;
}

export interface Evaluation {
  families: FamilyProgress[];
  singles: { single: Single; unlocked: boolean }[];
  /** Ids of everything currently earned. */
  earned: Set<string>;
}

export function evaluate(snapshot: AchievementSnapshot): Evaluation {
  const earned = new Set<string>();
  const families: FamilyProgress[] = [];
  for (const family of FAMILIES) {
    const value = family.metric(snapshot);
    if (value === null) continue;
    let tier: 0 | Tier = 0;
    family.tiers.forEach((target, index) => {
      if (value >= target) {
        tier = (index + 1) as Tier;
        earned.add(achievementId(family.id, tier));
      }
    });
    const next = tier < 4 ? family.tiers[tier] : null;
    const floor = tier === 0 ? 0 : family.tiers[tier - 1];
    families.push({ family, value, tier, next, progress: next === null ? 1 : Math.max(0, Math.min(1, (value - floor) / (next - floor))) });
  }
  const singles = SINGLES.flatMap((single) => {
    const result = single.test(snapshot);
    if (result === null) return [];
    if (result) earned.add(single.id);
    return [{ single, unlocked: result }];
  });
  return { families, singles, earned };
}

/* ---- Persistence ---- */

const STORE_KEY = "codey_achievements_v1";

export interface AchievementStore {
  /** False until the first check; that check records existing badges without announcing them. */
  seeded: boolean;
  unlockedAt: Record<string, number>;
  dailyDates: string[];
  rankedSessions: string[];
  /** Duel wins recorded on other devices (ids), pulled from the account. */
  syncedDuelWins: string[];
  syncedPartyWins: string[];
}

const emptyStore = (): AchievementStore => ({ seeded: false, unlockedAt: {}, dailyDates: [], rankedSessions: [], syncedDuelWins: [], syncedPartyWins: [] });

/** What the account keeps (Appwrite account prefs, key `achievements`), shared by every device. */
export interface AccountAchievements {
  v: 1;
  unlockedAt: Record<string, number>;
  dailyDates: string[];
  rankedSessions: string[];
  duelWins: string[];
  partyWins: string[];
}

const union = (a: string[] = [], b: string[] = [], cap = 1000) => [...new Set([...a, ...b])].slice(-cap);

/** Parses account prefs defensively; anything malformed is ignored. */
export function parseAccountAchievements(value: unknown): AccountAchievements | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AccountAchievements>;
  const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  const unlockedAt: Record<string, number> = {};
  for (const [id, at] of Object.entries(raw.unlockedAt ?? {})) if (typeof at === "number" && Number.isFinite(at) && describe(id)) unlockedAt[id] = at;
  return { v: 1, unlockedAt, dailyDates: strings(raw.dailyDates), rankedSessions: strings(raw.rankedSessions), duelWins: strings(raw.duelWins), partyWins: strings(raw.partyWins) };
}

/** Folds the account's record into this device's store: earliest unlock wins, lists are unioned. */
export function mergeIntoStore(store: AchievementStore, remote: AccountAchievements): AchievementStore {
  const unlockedAt = { ...store.unlockedAt };
  for (const [id, at] of Object.entries(remote.unlockedAt)) unlockedAt[id] = Math.min(at, unlockedAt[id] ?? Infinity);
  return {
    ...store,
    unlockedAt,
    dailyDates: union(store.dailyDates, remote.dailyDates, 400),
    rankedSessions: union(store.rankedSessions, remote.rankedSessions),
    syncedDuelWins: union(store.syncedDuelWins, remote.duelWins, 200),
    syncedPartyWins: union(store.syncedPartyWins, remote.partyWins, 50),
  };
}

/** What to write back to the account: this store plus duel wins recorded on this device. */
export function toAccountAchievements(store: AchievementStore, localDuelWins: string[], localPartyWins: string[]): AccountAchievements {
  return {
    v: 1,
    unlockedAt: store.unlockedAt,
    dailyDates: store.dailyDates.slice(-400),
    rankedSessions: store.rankedSessions.slice(-400),
    duelWins: union(store.syncedDuelWins, localDuelWins, 200),
    partyWins: union(store.syncedPartyWins, localPartyWins, 50),
  };
}

export function readStore(): AchievementStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...emptyStore(), ...(JSON.parse(raw) as Partial<AchievementStore>) } : emptyStore();
  } catch {
    return emptyStore();
  }
}

export function writeStore(store: AchievementStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked; badges recompute next time.
  }
}

/** Counts a finished Daily Challenge once per UTC date. */
export function recordDailyCompletion(date: string) {
  const store = readStore();
  if (store.dailyDates.includes(date)) return;
  writeStore({ ...store, dailyDates: [...store.dailyDates, date].slice(-400) });
}

/** Counts a verified Ranked run once per session. */
export function recordRankedVerified(sessionId: string) {
  const store = readStore();
  if (store.rankedSessions.includes(sessionId)) return;
  writeStore({ ...store, rankedSessions: [...store.rankedSessions, sessionId].slice(-1000) });
}

export interface UnlockedBadge {
  id: string;
  name: string;
  goal: string;
  family?: FamilyId;
  tier?: Tier;
  single?: SingleId;
}

export function describe(id: string): UnlockedBadge | null {
  const single = SINGLES.find((item) => item.id === id);
  if (single) return { id, name: single.name, goal: single.goal, single: single.id };
  const [familyId, tierText] = id.split(/-(?=\d$)/);
  const family = FAMILIES.find((item) => item.id === familyId);
  const tier = Number(tierText) as Tier;
  if (!family || !(tier >= 1 && tier <= 4)) return null;
  return { id, name: `${family.name} ${TIER_NUMERALS[tier]}`, goal: family.goal(family.tiers[tier - 1]), family: family.id, tier };
}

export const ACHIEVEMENT_EVENT = "codey:achievements-unlocked";

/**
 * Records newly earned badges and returns them. The first run on a device
 * only records (so existing players are not flooded with toasts); later
 * runs announce new badges through ACHIEVEMENT_EVENT.
 */
export function syncAchievements(snapshot: AchievementSnapshot, now = Date.now(), { silent = false } = {}): UnlockedBadge[] {
  const store = readStore();
  const { earned } = evaluate(snapshot);
  const fresh = [...earned].filter((id) => !(id in store.unlockedAt));
  if (fresh.length === 0 && store.seeded) return [];
  const unlockedAt = { ...store.unlockedAt };
  for (const id of fresh) unlockedAt[id] = now;
  writeStore({ ...store, seeded: true, unlockedAt });
  if (!store.seeded || silent) return [];
  const badges = fresh.map(describe).filter((badge): badge is UnlockedBadge => badge !== null);
  if (badges.length && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: badges }));
  return badges;
}
