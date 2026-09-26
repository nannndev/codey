// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefs: {} as Record<string, unknown>,
  profile: { $id: "me", currentStreak: 0, bestStreak: 0, lastActiveDate: null as string | null },
  profileUpdates: [] as Record<string, unknown>[],
  cloudRuns: [] as unknown[],
}));

vi.mock("./appwrite", () => ({
  appwriteConfig: { databaseId: "codetype", profilesCollectionId: "profiles", runsCollectionId: "runs" },
  account: {
    get: async () => ({ $id: "me", prefs: structuredClone(mocks.prefs) }),
    updatePrefs: async ({ prefs }: { prefs: Record<string, unknown> }) => {
      mocks.prefs = structuredClone(prefs);
      return { prefs };
    },
  },
  databases: {
    updateDocument: async ({ data }: { data: Record<string, unknown> }) => {
      mocks.profileUpdates.push(data);
      Object.assign(mocks.profile, data);
      return mocks.profile;
    },
  },
}));
vi.mock("./cloud", () => ({
  getProfile: async () => ({ ...mocks.profile }),
  syncLocalRuns: async () => undefined,
  pullCloudRuns: async () => 0,
}));

const { decide, mergeStreak, SLICES, syncAccount, SYNC_EVENT } = await import("./account-sync");
const slice = (id: string) => SLICES.find((item) => item.id === id)!;

/** A second device: its own storage, the same account. */
function switchDevice() {
  localStorage.clear();
}

beforeEach(() => {
  localStorage.clear();
  mocks.prefs = { dailyGoals: { runsPerDay: 5 } };
  mocks.profile = { $id: "me", currentStreak: 0, bestStreak: 0, lastActiveDate: null };
  mocks.profileUpdates = [];
});

describe("decide", () => {
  const lww = {};
  it("pushes when the account has nothing yet", () => {
    expect(decide(lww, { a: 1 }, undefined, undefined, undefined)).toEqual({ action: "push", value: { a: 1 } });
    expect(decide(lww, null, undefined, undefined, undefined)).toEqual({ action: "keep" });
  });

  it("takes the account's value on a new device", () => {
    expect(decide(lww, null, { at: 5, value: { a: 2 } }, undefined, undefined)).toEqual({ action: "pull", value: { a: 2 } });
  });

  it("keeps whichever side changed since the last sync", () => {
    const base = JSON.stringify({ a: 1 });
    expect(decide(lww, { a: 9 }, { at: 5, value: { a: 1 } }, base, 10)).toEqual({ action: "push", value: { a: 9 } });
    expect(decide(lww, { a: 1 }, { at: 5, value: { a: 7 } }, base, undefined)).toEqual({ action: "pull", value: { a: 7 } });
  });

  it("lets the later edit win when both sides changed", () => {
    const base = JSON.stringify({ a: 1 });
    expect(decide(lww, { a: 2 }, { at: 100, value: { a: 3 } }, base, 200)).toMatchObject({ action: "push" });
    expect(decide(lww, { a: 2 }, { at: 300, value: { a: 3 } }, base, 200)).toMatchObject({ action: "pull" });
  });

  it("merges collections instead of picking a side", () => {
    const arcade = slice("arcade");
    expect(decide(arcade, { home: 900, top: 0, code: 50 }, { at: 1, value: { home: 400, top: 700, code: 0 } }, undefined, undefined)).toEqual({
      action: "both",
      value: { home: 900, top: 700, code: 50 },
    });
  });
});

describe("mergeStreak", () => {
  it("keeps the best and the most recent current streak", () => {
    expect(mergeStreak({ current: 2, best: 9, lastDate: "2026-09-20" }, { current: 5, best: 5, lastDate: "2026-09-25" })).toEqual({ current: 5, best: 9, lastDate: "2026-09-25" });
    expect(mergeStreak({ current: 3, best: 3, lastDate: "2026-09-25" }, { current: 4, best: 4, lastDate: "2026-09-25" })).toEqual({ current: 4, best: 4, lastDate: "2026-09-25" });
  });
});

describe("duel history", () => {
  it("unions both devices' duels, newest first", () => {
    const duels = slice("duels");
    const merged = duels.merge!([{ id: "a", timestamp: 1 }, { id: "b", timestamp: 3 }], [{ id: "b", timestamp: 3 }, { id: "c", timestamp: 2 }]) as { id: string }[];
    expect(merged.map((duel) => duel.id)).toEqual(["b", "c", "a"]);
  });
});

describe("syncAccount across two devices", () => {
  it("carries preferences, theme, arcade scores and duels to a new device, without touching other prefs", async () => {
    localStorage.setItem("codetype-preferences", JSON.stringify({ fontSize: "20", editorTheme: "dracula" }));
    localStorage.setItem("codetype-theme", "dark");
    localStorage.setItem("codey_arcade_high_score_v2_home", "1234");
    localStorage.setItem("codey_duel_history_v1", JSON.stringify([{ id: "duel-1", timestamp: 5, outcome: "victory" }]));
    await syncAccount("me", { full: false });
    expect(mocks.prefs.dailyGoals).toEqual({ runsPerDay: 5 });

    switchDevice();
    const applied = vi.fn();
    window.addEventListener(SYNC_EVENT, applied);
    await syncAccount("me", { full: false });
    window.removeEventListener(SYNC_EVENT, applied);
    expect(JSON.parse(localStorage.getItem("codetype-preferences")!)).toMatchObject({ fontSize: "20", editorTheme: "dracula" });
    expect(localStorage.getItem("codetype-theme")).toBe("dark");
    expect(localStorage.getItem("codey_arcade_high_score_v2_home")).toBe("1234");
    expect(JSON.parse(localStorage.getItem("codey_duel_history_v1")!)).toHaveLength(1);
    expect(applied.mock.calls[0][0].detail).toEqual(expect.arrayContaining(["preferences", "theme", "arcade", "duels"]));
  });

  it("sends a later edit from the second device back to the first", async () => {
    localStorage.setItem("codetype-theme", "dark");
    await syncAccount("me", { full: false });
    const firstDevice = { ...localStorage };

    switchDevice();
    await syncAccount("me", { full: false });
    localStorage.setItem("codetype-theme", "light");
    const meta = JSON.parse(localStorage.getItem("codey_account_sync_v1")!);
    meta.changedAt.theme = Date.now();
    localStorage.setItem("codey_account_sync_v1", JSON.stringify(meta));
    await syncAccount("me", { full: false });

    localStorage.clear();
    for (const [key, value] of Object.entries(firstDevice)) localStorage.setItem(key, value as string);
    await syncAccount("me", { full: false });
    expect(localStorage.getItem("codetype-theme")).toBe("light");
  });

  it("syncs the streak with the public profile both ways", async () => {
    localStorage.setItem("codetype_streak", JSON.stringify({ current: 6, best: 11, lastDate: "2026-09-26" }));
    mocks.profile = { $id: "me", currentStreak: 2, bestStreak: 14, lastActiveDate: "2026-09-20T12:00:00.000Z" };
    await syncAccount("me", { full: false });
    expect(JSON.parse(localStorage.getItem("codetype_streak")!)).toMatchObject({ current: 6, best: 14, lastDate: "2026-09-26" });
    expect(mocks.profileUpdates.at(-1)).toMatchObject({ currentStreak: 6, bestStreak: 14 });
  });

  it("starts fresh bookkeeping when a different account signs in", async () => {
    localStorage.setItem("codetype-theme", "dark");
    await syncAccount("me", { full: false });
    mocks.prefs = { sync: { v: 1, slices: { theme: { at: 1, value: "light" } } } };
    await syncAccount("someone-else", { full: false });
    expect(localStorage.getItem("codetype-theme")).toBe("light");
  });
});
