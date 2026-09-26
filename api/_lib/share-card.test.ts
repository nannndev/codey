import { describe, expect, it } from "vitest";
import { formatLabel, loadSharedRun, shareHtml, type SharedRun } from "./share-card";

function fakeDb(docs: Record<string, Record<string, unknown>>) {
  const reads: string[] = [];
  return {
    reads,
    async getDocument({ documentId }: { documentId: string }) {
      reads.push(documentId);
      const doc = docs[documentId];
      if (!doc) throw Object.assign(new Error("not found"), { code: 404 });
      return doc;
    },
  };
}

const run = {
  userId: "user_1",
  language: "TypeScript",
  mode: "timed",
  durationSeconds: 30,
  wpm: 87.25,
  accuracy: 97.5,
  consistency: 80,
  verified: true,
  $createdAt: "2026-09-01T00:00:00.000Z",
};

describe("loadSharedRun", () => {
  it("joins the run with its player's profile", async () => {
    const db = fakeDb({ run_abc: run, user_1: { displayName: "Ada", githubUsername: "ada" } });
    const shared = await loadSharedRun("run_abc", db);
    expect(shared).toMatchObject({ id: "run_abc", name: "Ada", username: "ada", wpm: 87.25, format: "30s timed", verified: true });
    expect(shared?.avatarUrl).toBe("https://avatars.githubusercontent.com/ada?s=200");
  });

  it("rejects ids that are not Appwrite document ids without touching the database", async () => {
    const db = fakeDb({});
    for (const id of ["../profiles", "a b", "", "x".repeat(37)]) expect(await loadSharedRun(id, db)).toBeNull();
    expect(db.reads).toEqual([]);
  });

  it("returns null for a missing run and still shares a run without a profile", async () => {
    expect(await loadSharedRun("missing", fakeDb({}))).toBeNull();
    const shared = await loadSharedRun("run_abc", fakeDb({ run_abc: { ...run, verified: "yes" } }));
    expect(shared).toMatchObject({ name: "A Codey typist", username: null, avatarUrl: null, verified: false });
  });

  it("only trusts https avatars", async () => {
    const shared = await loadSharedRun("run_abc", fakeDb({ run_abc: run, user_1: { avatarUrl: "javascript:alert(1)" } }));
    expect(shared?.avatarUrl).toBeNull();
  });
});

describe("formatLabel", () => {
  it("describes each mode", () => {
    expect(formatLabel({ mode: "timed", durationMs: 60_000 })).toBe("60s timed");
    expect(formatLabel({ mode: "zen" })).toBe("zen");
    expect(formatLabel({ mode: "snippet", snippetLength: "long" })).toBe("long snippet");
  });
});

describe("shareHtml", () => {
  const shared: SharedRun = {
    id: "run_abc", userId: "user_1", name: `"><script>alert(1)</script>`, username: null, avatarUrl: null,
    language: "Go", mode: "timed", format: "30s timed", wpm: 90, accuracy: 99, consistency: 80, verified: false, createdAt: "",
  };

  it("points crawlers at the rendered card and people at the profile", () => {
    const html = shareHtml(shared, "https://codey.example", "run_abc");
    expect(html).toContain('<meta property="og:image" content="https://codey.example/api/og/run_abc">');
    expect(html).toContain('<meta property="og:url" content="https://codey.example/r/run_abc">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('location.replace("https://codey.example/profile/user_1")');
  });

  it("escapes player-controlled text", () => {
    const html = shareHtml(shared, "https://codey.example", "run_abc");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("falls back to the site card for an unknown run", () => {
    const html = shareHtml(null, "https://codey.example", "nope");
    expect(html).toContain("https://codey.example/og-default.png");
    expect(html).toContain('location.replace("https://codey.example")');
  });
});
