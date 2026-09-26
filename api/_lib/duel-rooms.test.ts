import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROOM_TTL_MS, listOpenRooms, parseListing, publishRoom, unpublishRoom, type DuelDb, type RoomListing } from "./duel-rooms";

/** In-memory Appwrite collection that understands the queries the module sends. */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown> & { $id: string }>();
  const notFound = () => Object.assign(new Error("not found"), { code: 404 });
  const db: DuelDb = {
    async getDocument({ documentId }) {
      const doc = docs.get(documentId);
      if (!doc) throw notFound();
      return { ...doc };
    },
    async createDocument({ documentId, data }) {
      const doc = { $id: documentId, ...data };
      docs.set(documentId, doc);
      return doc;
    },
    async updateDocument({ documentId, data }) {
      const doc = { ...docs.get(documentId)!, ...data };
      docs.set(documentId, doc);
      return doc;
    },
    async deleteDocument({ documentId }) {
      docs.delete(documentId);
      return {};
    },
    async listDocuments({ queries = [] }) {
      let list = [...docs.values()];
      let limit = 25;
      for (const raw of queries) {
        const query = JSON.parse(raw) as { method: string; attribute: string; values: unknown[] };
        const value = (doc: Record<string, unknown>) => doc[query.attribute] as string;
        if (query.method === "equal") list = list.filter((doc) => query.values.includes(value(doc)));
        if (query.method === "greaterThan") list = list.filter((doc) => value(doc) > (query.values[0] as string));
        if (query.method === "lessThan") list = list.filter((doc) => value(doc) < (query.values[0] as string));
        if (query.method === "limit") limit = query.values[0] as number;
      }
      return { documents: list.slice(0, limit) };
    },
  };
  return { db, docs };
}

const NOW = Date.parse("2026-09-26T10:00:00Z");
const host = { id: "host-a", name: "Nande" };
const body = { code: "CODEY-ABC123", language: "Rust", mode: "snippet", detail: "medium", players: 1, maxPlayers: 4, status: "lobby", custom: false };
const listing = (overrides: Record<string, unknown> = {}, who = host, at = NOW): RoomListing => {
  const parsed = parseListing({ ...body, ...overrides }, who, at);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.listing;
};

describe("parseListing", () => {
  it("takes the host from the session, never from the body", () => {
    const parsed = parseListing({ ...body, hostId: "someone-else", hostName: "Spoof" }, host, NOW);
    expect("listing" in parsed && parsed.listing).toMatchObject({ hostId: "host-a", hostName: "Nande", heartbeatAt: new Date(NOW).toISOString() });
  });

  it.each([
    [{ code: "not-a-code" }, "Invalid room code."],
    [{ code: "codey-abc12" }, "Invalid room code."],
    [{ mode: "zen" }, "Invalid mode."],
    [{ status: "finished" }, "Invalid status."],
  ])("rejects %o", (overrides, error) => {
    expect(parseListing({ ...body, ...overrides }, host)).toEqual({ error });
  });

  it("accepts a lower-case code and clamps room sizes", () => {
    const parsed = listing({ code: "codey-abc123", players: 40, maxPlayers: 99 });
    expect(parsed).toMatchObject({ code: "CODEY-ABC123", maxPlayers: 6, players: 6 });
    expect(listing({ maxPlayers: 1, players: 0 })).toMatchObject({ maxPlayers: 2, players: 1 });
  });

  it("strips control characters and caps text", () => {
    expect(listing({ language: "Ru\u0000st\n", detail: "x".repeat(80) })).toMatchObject({ language: "Rust", detail: "x".repeat(32) });
  });
});

describe("publish, list and unpublish", () => {
  let store: ReturnType<typeof fakeDb>;
  beforeEach(() => {
    store = fakeDb();
  });

  it("lists a published room", async () => {
    await publishRoom(store.db, listing(), NOW);
    const rooms = await listOpenRooms(store.db, NOW + 1000);
    expect(rooms.map((room) => room.code)).toEqual(["CODEY-ABC123"]);
  });

  it("refreshes the host's own listing in place", async () => {
    await publishRoom(store.db, listing(), NOW);
    await publishRoom(store.db, listing({ players: 3 }, host, NOW + 20_000), NOW + 20_000);
    expect(store.docs.size).toBe(1);
    expect(store.docs.get("CODEY-ABC123")).toMatchObject({ players: 3 });
  });

  it("refuses to overwrite someone else's live room", async () => {
    await publishRoom(store.db, listing(), NOW);
    const result = await publishRoom(store.db, listing({}, { id: "host-b", name: "Rafi" }), NOW + 5_000);
    expect(result).toEqual({ error: "That room belongs to someone else.", status: 403 });
    expect(store.docs.get("CODEY-ABC123")).toMatchObject({ hostId: "host-a" });
  });

  it("lets a new host take over a code whose listing went stale", async () => {
    await publishRoom(store.db, listing(), NOW);
    const later = NOW + 11 * 60_000;
    expect(await publishRoom(store.db, listing({}, { id: "host-b", name: "Rafi" }, later), later)).toEqual({ ok: true });
  });

  it("keeps one live room per host", async () => {
    await publishRoom(store.db, listing({ code: "CODEY-AAA111" }), NOW);
    await publishRoom(store.db, listing({ code: "CODEY-BBB222" }), NOW);
    expect([...store.docs.keys()]).toEqual(["CODEY-BBB222"]);
  });

  it("hides rooms whose host stopped refreshing, then purges them", async () => {
    await publishRoom(store.db, listing(), NOW);
    expect(await listOpenRooms(store.db, NOW + ROOM_TTL_MS + 1000)).toEqual([]);
    expect(store.docs.size).toBe(1);
    await listOpenRooms(store.db, NOW + 11 * 60_000);
    await vi.waitFor(() => expect(store.docs.size).toBe(0));
  });

  it("puts waiting rooms before racing ones, fullest first", async () => {
    await publishRoom(store.db, listing({ code: "CODEY-AAA111", players: 1 }, { id: "a", name: "A" }), NOW);
    await publishRoom(store.db, listing({ code: "CODEY-BBB222", players: 3 }, { id: "b", name: "B" }), NOW);
    await publishRoom(store.db, listing({ code: "CODEY-CCC333", players: 4, status: "racing" }, { id: "c", name: "C" }), NOW);
    const rooms = await listOpenRooms(store.db, NOW);
    expect(rooms.map((room) => room.code)).toEqual(["CODEY-BBB222", "CODEY-AAA111", "CODEY-CCC333"]);
  });

  it("only lets the host delete their room", async () => {
    await publishRoom(store.db, listing(), NOW);
    expect(await unpublishRoom(store.db, "host-b", "CODEY-ABC123")).toMatchObject({ status: 403 });
    expect(store.docs.size).toBe(1);
    expect(await unpublishRoom(store.db, "host-a", "codey-abc123")).toEqual({ ok: true });
    expect(store.docs.size).toBe(0);
  });

  it("treats deleting a missing room as done", async () => {
    expect(await unpublishRoom(store.db, "host-a", "CODEY-ZZZ999")).toEqual({ ok: true });
  });
});
