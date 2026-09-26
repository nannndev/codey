// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefs: {} as Record<string, unknown>,
  updatePrefs: vi.fn(),
  cloudRuns: [] as unknown[],
  dailyTotal: 0,
}));

vi.mock("./appwrite", () => ({
  appwriteConfig: { databaseId: "codetype", dailyRunsCollectionId: "daily_runs" },
  account: {
    get: async () => ({ $id: "me", prefs: mocks.prefs }),
    updatePrefs: async ({ prefs }: { prefs: Record<string, unknown> }) => {
      mocks.updatePrefs(prefs);
      mocks.prefs = prefs;
    },
  },
  databases: { listDocuments: async () => ({ total: mocks.dailyTotal, documents: [] }) },
}));
vi.mock("./cloud", () => ({
  listUserRuns: async () => mocks.cloudRuns,
  getProfile: async () => ({ bestStreak: 0 }),
}));
vi.mock("./keyboard-stats-cloud", () => ({ getCloudKeyboardStats: async () => ({}) }));

const { ACHIEVEMENT_EVENT, readStore } = await import("./achievements");
const { checkAchievements, localSnapshot, publicSnapshot, syncAchievementsForAccount } = await import("./achievement-snapshot");

let clock = Date.parse("2026-09-20T12:00:00Z");
const cloudRun = (wpm: number, overrides: Record<string, unknown> = {}) => {
  clock += 3_600_000;
  return { $id: `c${clock}`, $createdAt: new Date(clock).toISOString(), userId: "me", language: "Rust", mode: "snippet", durationMs: 40_000, wpm, rawWpm: wpm, accuracy: 96, consistency: 80, correctChars: 200, keystrokes: 210, mistakes: 4, snippetsCompleted: 1, verified: false, ...overrides };
};
const localRun = (wpm: number) => {
  clock += 3_600_000;
  return { id: `l${clock}`, language: "Go", wpm, accuracy: 95, duration: 40_000, charsTyped: 200, timestamp: clock, mode: "snippet", rawWpm: wpm, consistency: 80, totalErrors: 3, totalCorrect: 197, perLineStats: [], errorPositions: [], snippetsCompleted: 1 };
};

beforeEach(() => {
  localStorage.clear();
  mocks.prefs = { dailyGoals: { runs: 5 } };
  mocks.updatePrefs.mockClear();
  mocks.cloudRuns = [];
  mocks.dailyTotal = 0;
});

describe("account sync", () => {
  it("counts runs from other devices and verified results from the server", async () => {
    mocks.cloudRuns = [cloudRun(112), cloudRun(80, { verified: true })];
    mocks.dailyTotal = 6;
    localStorage.setItem("codetype_history", JSON.stringify([localRun(60)]));
    await syncAchievementsForAccount("me");
    const snapshot = localSnapshot("me");
    expect(snapshot.runs).toHaveLength(3);
    expect(Math.max(...snapshot.runs.map((run) => run.wpm))).toBe(112);
    expect(snapshot.dailyCompleted).toBe(6);
    expect(snapshot.rankedVerified).toBe(1);
    expect(readStore().unlockedAt).toHaveProperty("speed-3");
  });

  it("records the first account sync silently, then announces new badges", async () => {
    mocks.cloudRuns = [cloudRun(80)];
    const listener = vi.fn();
    window.addEventListener(ACHIEVEMENT_EVENT, listener);
    expect(await syncAchievementsForAccount("me")).toEqual([]);
    expect(listener).not.toHaveBeenCalled();

    localStorage.setItem("codetype_history", JSON.stringify([localRun(101)]));
    const fresh = checkAchievements("me");
    expect(fresh.map((badge) => badge.id)).toContain("speed-3");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ACHIEVEMENT_EVENT, listener);
  });

  it("saves to the account without touching other prefs", async () => {
    mocks.cloudRuns = [cloudRun(80)];
    await syncAchievementsForAccount("me");
    expect(mocks.updatePrefs).toHaveBeenCalledTimes(1);
    const saved = mocks.updatePrefs.mock.calls[0][0] as Record<string, { unlockedAt: Record<string, number> }>;
    expect(saved.dailyGoals).toEqual({ runs: 5 });
    expect(Object.keys(saved.achievements.unlockedAt)).toEqual(expect.arrayContaining(["speed-1", "speed-2"]));
  });

  it("brings another device's badges and duel wins in without announcing them", async () => {
    mocks.prefs = {
      achievements: {
        v: 1,
        unlockedAt: { "duel-1": 1000, "speed-1": 2000, "made-up-9": 5 },
        dailyDates: ["2026-09-01"],
        rankedSessions: [],
        duelWins: ["other-device-duel"],
        partyWins: [],
      },
    };
    localStorage.setItem("codey_achievements_v1", JSON.stringify({ seeded: true, unlockedAt: { "speed-1": 9000 }, dailyDates: [], rankedSessions: [], syncedDuelWins: [], syncedPartyWins: [] }));
    const listener = vi.fn();
    window.addEventListener(ACHIEVEMENT_EVENT, listener);
    await syncAchievementsForAccount("me");
    window.removeEventListener(ACHIEVEMENT_EVENT, listener);
    const store = readStore();
    expect(store.unlockedAt["speed-1"]).toBe(2000); // earliest unlock wins
    expect(store.unlockedAt["duel-1"]).toBe(1000);
    expect(store.unlockedAt).not.toHaveProperty("made-up-9");
    expect(localSnapshot("me")).toMatchObject({ duelWins: 1, dailyCompleted: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("runs one sync at a time per player", async () => {
    await Promise.all([syncAchievementsForAccount("me"), syncAchievementsForAccount("me"), syncAchievementsForAccount("me")]);
    expect(mocks.updatePrefs.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("public profiles", () => {
  it("use only server-verified data", async () => {
    mocks.dailyTotal = 3;
    const snapshot = await publicSnapshot("someone", [cloudRun(90, { verified: true }), cloudRun(70)] as never);
    expect(snapshot).toMatchObject({ dailyCompleted: 3, rankedVerified: 1, duelWins: null, keystrokes: null, partyWins: null });
    expect(snapshot.runs).toHaveLength(2);
  });
});
