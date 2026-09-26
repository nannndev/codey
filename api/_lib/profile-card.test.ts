import { describe, expect, it } from "vitest";
import { loadSharedProfile, profileShareHtml, PROFILE_TREND_RUNS, type ProfileDb } from "./profile-card";

const DAY = 86_400_000;

function fakeDb(profile: Record<string, unknown> | null, runs: Record<string, unknown>[]) {
  const calls: string[] = [];
  const db: ProfileDb = {
    async getDocument({ documentId }) {
      calls.push(`get:${documentId}`);
      if (!profile) throw Object.assign(new Error("not found"), { code: 404 });
      return profile;
    },
    async listDocuments() {
      calls.push("list");
      return { documents: runs };
    },
  };
  return { db, calls };
}

const run = (daysAgo: number, wpm: number, language = "TypeScript") => ({
  $createdAt: new Date(Date.now() - daysAgo * DAY).toISOString(), wpm, accuracy: 96, language, mode: "timed", durationMs: 30_000,
});

describe("loadSharedProfile", () => {
  it("sums up the player's cloud runs like the profile page", async () => {
    const runs = [run(0, 110), run(1, 90, "Python"), run(2, 100)];
    const { db } = fakeDb({ displayName: "Ada", githubUsername: "ada", bestStreak: 1 }, runs);
    const profile = await loadSharedProfile("user_1", db);
    expect(profile).toMatchObject({ name: "Ada", username: "ada", runs: 3, bestWpm: 110, bestLanguage: "TypeScript", avgWpm: 100, avgAccuracy: 96, topLanguage: "TypeScript", bestStreak: 3 });
    // Oldest first, so the bars read left to right.
    expect(profile?.trend).toEqual([100, 90, 110]);
    expect(profile?.division?.name).toMatch(/\w+ \w+/);
  });

  it("keeps only the most recent runs in the trend", async () => {
    const runs = Array.from({ length: 30 }, (_, index) => run(index, 60 + index));
    const profile = await loadSharedProfile("user_1", fakeDb({}, runs).db);
    expect(profile?.trend).toHaveLength(PROFILE_TREND_RUNS);
    expect(profile?.trend[PROFILE_TREND_RUNS - 1]).toBe(60);
  });

  it("returns null for unknown players and bad ids", async () => {
    expect(await loadSharedProfile("user_1", fakeDb(null, []).db)).toBeNull();
    const { db, calls } = fakeDb({}, []);
    expect(await loadSharedProfile("../runs", db)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("shares a profile with no runs", async () => {
    const profile = await loadSharedProfile("user_1", fakeDb({ githubUsername: "new" }, []).db);
    expect(profile).toMatchObject({ name: "new", runs: 0, bestWpm: 0, division: null, trend: [] });
  });
});

describe("profileShareHtml", () => {
  it("previews with the profile card and opens the profile", async () => {
    const profile = await loadSharedProfile("user_1", fakeDb({ displayName: "<b>Ada</b>" }, [run(0, 100)]).db);
    const html = profileShareHtml(profile, "https://codey.example", "user_1");
    expect(html).toContain('content="https://codey.example/api/og/user_1?kind=profile&amp;v=');
    expect(html).toContain('<meta property="og:url" content="https://codey.example/p/user_1">');
    expect(html).toContain('location.replace("https://codey.example/profile/user_1")');
    expect(html).not.toContain("<b>Ada</b>");
  });
});
