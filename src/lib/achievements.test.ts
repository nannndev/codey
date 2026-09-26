// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACHIEVEMENT_EVENT,
  TOTAL_ACHIEVEMENTS,
  describe as describeBadge,
  evaluate,
  readStore,
  recordDailyCompletion,
  recordRankedVerified,
  syncAchievements,
  type AchievementSnapshot,
  type SnapshotRun,
} from "./achievements";

const run = (overrides: Partial<SnapshotRun> = {}): SnapshotRun => ({
  timestamp: new Date(2026, 8, 20, 14).getTime(),
  wpm: 60,
  accuracy: 95,
  language: "TypeScript",
  duration: 60_000,
  charsTyped: 300,
  ...overrides,
});
const snapshot = (overrides: Partial<AchievementSnapshot> = {}): AchievementSnapshot => ({
  runs: [],
  bestStreak: 0,
  keystrokes: 0,
  duelWins: 0,
  partyWins: 0,
  dailyCompleted: 0,
  rankedVerified: 0,
  ...overrides,
});
const family = (evaluation: ReturnType<typeof evaluate>, id: string) => evaluation.families.find((item) => item.family.id === id)!;

beforeEach(() => localStorage.clear());

describe("evaluate", () => {
  it("earns every tier up to the value and measures progress to the next", () => {
    const speed = family(evaluate(snapshot({ runs: [run({ wpm: 88 })] })), "speed");
    expect(speed).toMatchObject({ tier: 2, next: 100, value: 88 });
    expect(speed.progress).toBeCloseTo((88 - 75) / (100 - 75));
  });

  it("marks Diamond as complete", () => {
    const streak = family(evaluate(snapshot({ bestStreak: 45 })), "streak");
    expect(streak).toMatchObject({ tier: 4, next: null, progress: 1 });
  });

  it("counts languages, precision runs and typing time", () => {
    const runs = ["Go", "Rust", "Python", "Go"].map((language, index) => run({ language, accuracy: index < 2 ? 99 : 90, duration: 10 * 60_000 }));
    const evaluation = evaluate(snapshot({ runs }));
    expect(family(evaluation, "polyglot")).toMatchObject({ value: 3, tier: 1 });
    expect(family(evaluation, "precision")).toMatchObject({ value: 2, tier: 0 });
    expect(family(evaluation, "time")).toMatchObject({ value: 40, tier: 1 });
  });

  it("hides families whose data is unknown instead of showing zero", () => {
    const evaluation = evaluate(snapshot({ duelWins: null, keystrokes: null, partyWins: null }));
    expect(evaluation.families.map((item) => item.family.id)).not.toContain("duel");
    expect(evaluation.families.map((item) => item.family.id)).not.toContain("keys");
    expect(evaluation.singles.map((item) => item.single.id)).not.toContain("party");
  });

  it("checks the one-off feats", () => {
    const earned = evaluate(snapshot({
      runs: [run({ accuracy: 100, charsTyped: 200 }), run({ timestamp: new Date(2026, 8, 20, 2).getTime() })],
      partyWins: 1,
    })).earned;
    expect(earned.has("flawless")).toBe(true);
    expect(earned.has("night-owl")).toBe(true);
    expect(earned.has("party")).toBe(true);
    expect(earned.has("early-bird")).toBe(false);
  });

  it("does not count a short perfect run as flawless", () => {
    expect(evaluate(snapshot({ runs: [run({ accuracy: 100, charsTyped: 80 })] })).earned.has("flawless")).toBe(false);
  });

  it("covers the whole catalogue", () => {
    expect(TOTAL_ACHIEVEMENTS).toBe(48);
  });
});

describe("describe", () => {
  it("names tiers and singles", () => {
    expect(describeBadge("speed-3")).toMatchObject({ name: "Velocity III", goal: "Hit 100 WPM in a run", tier: 3 });
    expect(describeBadge("night-owl")).toMatchObject({ name: "Night Owl", single: "night-owl" });
    expect(describeBadge("speed-9")).toBeNull();
    expect(describeBadge("nope-1")).toBeNull();
  });
});

describe("syncAchievements", () => {
  it("records existing badges silently the first time", () => {
    const listener = vi.fn();
    window.addEventListener(ACHIEVEMENT_EVENT, listener);
    expect(syncAchievements(snapshot({ runs: [run({ wpm: 80 })] }), 1000)).toEqual([]);
    expect(readStore()).toMatchObject({ seeded: true, unlockedAt: { "speed-1": 1000, "speed-2": 1000 } });
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(ACHIEVEMENT_EVENT, listener);
  });

  it("announces only newly earned badges afterwards, and keeps the first unlock time", () => {
    syncAchievements(snapshot({ runs: [run({ wpm: 60 })] }), 1000);
    const listener = vi.fn();
    window.addEventListener(ACHIEVEMENT_EVENT, listener);
    const fresh = syncAchievements(snapshot({ runs: [run({ wpm: 60 }), run({ wpm: 101 })] }), 2000);
    expect(fresh.map((badge) => badge.id).sort()).toEqual(["speed-2", "speed-3"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readStore().unlockedAt["speed-1"]).toBe(1000);
    expect(syncAchievements(snapshot({ runs: [run({ wpm: 101 })] }), 3000)).toEqual([]);
    window.removeEventListener(ACHIEVEMENT_EVENT, listener);
  });

  it("counts each Daily date and Ranked session once", () => {
    recordDailyCompletion("2026-09-25");
    recordDailyCompletion("2026-09-25");
    recordDailyCompletion("2026-09-26");
    recordRankedVerified("s1");
    recordRankedVerified("s1");
    expect(readStore()).toMatchObject({ dailyDates: ["2026-09-25", "2026-09-26"], rankedSessions: ["s1"] });
  });

  it("survives a corrupt store", () => {
    localStorage.setItem("codey_achievements_v1", "{not json");
    expect(readStore().seeded).toBe(false);
  });
});

describe("account record", async () => {
  const { mergeIntoStore, parseAccountAchievements, toAccountAchievements } = await import("./achievements");
  const store = { seeded: true, unlockedAt: { "speed-1": 500, "runs-1": 100 }, dailyDates: ["a"], rankedSessions: ["r1"], syncedDuelWins: [], syncedPartyWins: [] };

  it("merges with the earliest unlock and unions the lists", () => {
    const merged = mergeIntoStore(store, { v: 1, unlockedAt: { "speed-1": 300, "duel-1": 900 }, dailyDates: ["a", "b"], rankedSessions: ["r2"], duelWins: ["d1"], partyWins: [] });
    expect(merged.unlockedAt).toEqual({ "speed-1": 300, "runs-1": 100, "duel-1": 900 });
    expect(merged.dailyDates).toEqual(["a", "b"]);
    expect(merged.rankedSessions).toEqual(["r1", "r2"]);
    expect(merged.syncedDuelWins).toEqual(["d1"]);
  });

  it("drops malformed data from the account", () => {
    expect(parseAccountAchievements("nope")).toBeNull();
    expect(parseAccountAchievements({ unlockedAt: { "speed-1": "x", "fake-1": 1, "speed-2": 7 }, dailyDates: [1, "d"] })).toMatchObject({ unlockedAt: { "speed-2": 7 }, dailyDates: ["d"] });
  });

  it("writes duel wins from this device together with ones from others", () => {
    const record = toAccountAchievements({ ...store, syncedDuelWins: ["d1"] }, ["d1", "d2"], ["d2"]);
    expect(record.duelWins).toEqual(["d1", "d2"]);
    expect(record.partyWins).toEqual(["d2"]);
  });
});
