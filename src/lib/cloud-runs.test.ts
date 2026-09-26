// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), creates: [] as string[] }));

vi.mock("@/lib/appwrite", () => ({
  appwriteConfig: { databaseId: "codetype", runsCollectionId: "runs", profilesCollectionId: "profiles" },
  account: null,
  databases: {
    listDocuments: async ({ queries }: { queries: string[] }) => {
      const parsed = queries.map((raw) => JSON.parse(raw) as { method: string; attribute: string; values: string[] });
      const byId = parsed.find((query) => query.method === "equal" && query.attribute === "$id");
      const documents = [...mocks.docs.values()].filter((doc) => !byId || byId.values.includes(doc.$id as string));
      return { total: documents.length, documents };
    },
    createDocument: async ({ documentId, data }: { documentId: string; data: Record<string, unknown> }) => {
      if (mocks.docs.has(documentId)) throw Object.assign(new Error("exists"), { code: 409 });
      mocks.creates.push(documentId);
      const doc = { $id: documentId, $createdAt: new Date().toISOString(), ...data };
      mocks.docs.set(documentId, doc);
      return doc;
    },
  },
}));

const { pullCloudRuns, syncLocalRuns, uploadRun } = await import("./cloud");
const { getHistory, saveResult } = await import("@/utils/storage");

const run = (wpm: number, timestamp: number) => ({
  language: "Go", wpm, accuracy: 85, duration: 30_000, charsTyped: 150, timestamp, mode: "snippet" as const, rawWpm: wpm, consistency: 70,
  totalErrors: 20, totalCorrect: 130, perLineStats: [], errorPositions: [], snippetsCompleted: 1, snippetLength: "medium" as const,
});

beforeEach(() => {
  localStorage.clear();
  mocks.docs.clear();
  mocks.creates = [];
});

describe("runs follow the account", () => {
  it("uploads every saved run, including ones below leaderboard accuracy", async () => {
    const saved = saveResult(run(40, 1_000));
    await uploadRun("me", saved);
    expect(mocks.creates).toHaveLength(1);
    // The next full sync recognises the same run instead of uploading a duplicate.
    await syncLocalRuns("me", getHistory());
    expect(mocks.creates).toHaveLength(1);
  });

  it("pulls runs from other devices once, and never re-uploads them", async () => {
    mocks.docs.set("run_from_laptop", { $id: "run_from_laptop", $createdAt: "2026-09-20T10:00:00.000Z", userId: "me", language: "Rust", mode: "timed", durationMs: 30_000, durationSeconds: 30, wpm: 77, rawWpm: 80, accuracy: 96, consistency: 80, correctChars: 300, keystrokes: 310, mistakes: 10, snippetsCompleted: 1, verified: false });
    expect(await pullCloudRuns("me")).toBe(1);
    expect(await pullCloudRuns("me")).toBe(0);
    const pulled = getHistory().find((item) => item.cloudId === "run_from_laptop");
    expect(pulled).toMatchObject({ language: "Rust", wpm: 77, duration: 30_000 });
    await syncLocalRuns("me", getHistory());
    expect(mocks.creates).toHaveLength(0);
  });
});
