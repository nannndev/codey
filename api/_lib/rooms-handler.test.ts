import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string; name: string } | null,
  configured: true,
  list: vi.fn(async () => [] as unknown[]),
  publish: vi.fn(async () => ({ ok: true })),
  unpublish: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./appwrite-admin.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./appwrite-admin.js")>()),
  isConfigured: () => mocks.configured,
  adminDatabases: () => ({}),
  authenticateUser: async () => mocks.user,
}));
vi.mock("./duel-rooms.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./duel-rooms.js")>()),
  listOpenRooms: mocks.list,
  publishRoom: mocks.publish,
  unpublishRoom: mocks.unpublish,
}));

const { default: handler } = await import("../duel/rooms");

async function call(method: string, { body, query = {} }: { body?: unknown; query?: Record<string, string> } = {}) {
  const res = { statusCode: 0, payload: undefined as unknown, headers: {} as Record<string, string> };
  const response = {
    status(code: number) { res.statusCode = code; return response; },
    setHeader(name: string, value: string) { res.headers[name] = value; },
    json(payload: unknown) { res.payload = payload; },
  };
  await handler({ method, headers: {}, query, body }, response);
  return res;
}

const room = { code: "CODEY-ABC123", language: "Rust", mode: "snippet", detail: "medium", players: 1, maxPlayers: 4, status: "lobby", custom: false };

beforeEach(() => {
  mocks.user = null;
  mocks.configured = true;
});

describe("/api/duel/rooms", () => {
  it("lists rooms without signing in, uncached", async () => {
    const res = await call("GET");
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ rooms: [] });
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("requires sign-in to publish or delete", async () => {
    expect((await call("POST", { body: room })).statusCode).toBe(401);
    expect((await call("DELETE", { query: { code: room.code } })).statusCode).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("publishes with the signed-in host", async () => {
    mocks.user = { id: "host-a", name: "Nande" };
    const res = await call("POST", { body: JSON.stringify({ ...room, hostId: "evil" }) });
    expect(res.statusCode).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "CODEY-ABC123", hostId: "host-a", hostName: "Nande" }));
  });

  it("rejects an invalid listing before touching the database", async () => {
    mocks.user = { id: "host-a", name: "Nande" };
    const res = await call("POST", { body: { ...room, code: "nope" } });
    expect(res.statusCode).toBe(400);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("passes ownership errors through", async () => {
    mocks.user = { id: "host-b", name: "Rafi" };
    mocks.publish.mockResolvedValueOnce({ error: "That room belongs to someone else.", status: 403 } as never);
    expect((await call("POST", { body: room })).statusCode).toBe(403);
  });

  it("answers 503 when the service is not configured or the database fails", async () => {
    mocks.configured = false;
    expect((await call("GET")).statusCode).toBe(503);
    mocks.configured = true;
    mocks.list.mockRejectedValueOnce(new Error("down"));
    expect((await call("GET")).statusCode).toBe(503);
  });

  it("rejects other methods", async () => {
    mocks.user = { id: "host-a", name: "Nande" };
    expect((await call("PUT")).statusCode).toBe(405);
  });
});
