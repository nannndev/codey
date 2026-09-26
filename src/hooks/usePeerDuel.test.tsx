// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

/**
 * In-memory stand-in for PeerJS: peers register by id, connections come in
 * pairs and deliver messages asynchronously, like the real data channel.
 */
vi.mock("peerjs", () => {
  type Handler = (...args: unknown[]) => void;
  class Emitter {
    private handlers = new Map<string, Handler[]>();
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args);
    }
  }
  const registry = new Map<string, FakePeer>();
  const later = (fn: () => void) => setTimeout(fn, 1);

  class FakeConn extends Emitter {
    open = false;
    other: FakeConn | null = null;
    closed = false;
    constructor(public peer: string, public metadata?: unknown) {
      super();
    }
    send(data: unknown) {
      if (!this.open) return;
      const copy = structuredClone(data);
      later(() => this.other?.open && this.other.emit("data", copy));
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      later(() => this.emit("close"));
      this.other?.close();
    }
  }

  class FakePeer extends Emitter {
    destroyed = false;
    conns: FakeConn[] = [];
    constructor(public id: string) {
      super();
      later(() => {
        if (registry.has(id)) return this.emit("error", Object.assign(new Error("taken"), { type: "unavailable-id" }));
        registry.set(id, this);
        this.emit("open", id);
      });
    }
    connect(target: string, options?: { metadata?: unknown }) {
      const local = new FakeConn(target, options?.metadata);
      this.conns.push(local);
      later(() => {
        const host = registry.get(target);
        if (!host || host.destroyed) return this.emit("error", Object.assign(new Error("no peer"), { type: "peer-unavailable" }));
        const remote = new FakeConn(this.id, options?.metadata);
        host.conns.push(remote);
        local.other = remote;
        remote.other = local;
        host.emit("connection", remote);
        later(() => {
          local.open = true;
          remote.open = true;
          remote.emit("open");
          local.emit("open");
        });
      });
      return local;
    }
    destroy() {
      this.destroyed = true;
      registry.delete(this.id);
      for (const conn of this.conns) conn.close();
    }
  }
  return { default: FakePeer };
});

const { usePeerDuel, normalizeRoomCode, DEFAULT_DUEL_CONFIG } = await import("./usePeerDuel");

type Duel = ReturnType<typeof usePeerDuel>;
const player = (name: string, maxPlayers = 4) =>
  renderHook(() => usePeerDuel(name, { ...DEFAULT_DUEL_CONFIG, maxPlayers })).result;

async function hostRoom(maxPlayers = 4) {
  const host = player("Host", maxPlayers);
  await act(() => host.current.createRoom(undefined, { ...DEFAULT_DUEL_CONFIG, maxPlayers }));
  await waitFor(() => expect(host.current.duelState).toBe("lobby"));
  return host;
}

async function join(host: { current: Duel }, name: string) {
  const guest = player(name);
  await act(() => guest.current.joinRoom(host.current.roomCode.replace("CODEY-", "")));
  await waitFor(() => expect(guest.current.duelState).toBe("lobby"));
  return guest;
}

const names = (duel: Duel) => duel.players.map((item) => item.name);

async function everyoneReady(players: { current: Duel }[]) {
  for (const duel of players) act(() => duel.current.toggleReady());
  await waitFor(() => expect(players[0].current.players.every((item) => item.ready)).toBe(true));
}

async function startRace(players: { current: Duel }[]) {
  const [host] = players;
  await everyoneReady(players);
  act(() => host.current.startMatch());
  for (const duel of players) await waitFor(() => expect(duel.current.duelState).toBe("racing"), { timeout: 6000 });
}

afterEach(() => cleanup());

describe("normalizeRoomCode", () => {
  it("adds the prefix and upper-cases", () => {
    expect(normalizeRoomCode(" x8k2qa ")).toBe("CODEY-X8K2QA");
    expect(normalizeRoomCode("codey-x8k2qa")).toBe("CODEY-X8K2QA");
  });
});

describe("usePeerDuel room protocol", () => {
  it("joins players into one roster, named from their connection", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    const b = await join(host, "Dewi");
    for (const duel of [host, a, b]) await waitFor(() => expect(names(duel.current)).toEqual(["Host", "Rafi", "Dewi"]));
    expect(a.current.isHost).toBe(false);
    expect(a.current.snippet.code).toBe(host.current.snippet.code);
  });

  it("shares ready state and races everyone on the same code", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    const b = await join(host, "Dewi");
    await startRace([host, a, b]);
    expect(new Set([host, a, b].map((duel) => duel.current.snippet.code)).size).toBe(1);
  }, 15_000);

  it("relays progress and closes the race once the places are settled", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    const b = await join(host, "Dewi");
    await startRace([host, a, b]);
    const length = host.current.snippet.code.length;

    act(() => b.current.sendProgress({ cursorIndex: 20, wpm: 50, accuracy: 96, completed: false }));
    await waitFor(() => expect(a.current.players.find((item) => item.name === "Dewi")?.cursorIndex).toBe(20));

    act(() => a.current.sendProgress({ cursorIndex: length, wpm: 90, accuracy: 98, completed: true, finishTimeMs: 20_000 }));
    // One finisher out of three: the others still race, inside the straggler window.
    await waitFor(() => expect(host.current.finishDeadline).not.toBeNull());
    expect(host.current.duelState).toBe("racing");

    act(() => host.current.sendProgress({ cursorIndex: length, wpm: 80, accuracy: 97, completed: true, finishTimeMs: 24_000 }));
    for (const duel of [host, a, b]) await waitFor(() => expect(duel.current.duelState).toBe("finished"));
    const finished = b.current.players.filter((item) => item.completed).map((item) => item.name);
    expect(finished.sort()).toEqual(["Host", "Rafi"]);
  }, 15_000);

  it("resets everyone to the lobby on a rematch request from a guest", async () => {
    const host = await hostRoom(2);
    const a = await join(host, "Rafi");
    await startRace([host, a]);
    const length = host.current.snippet.code.length;
    act(() => a.current.sendProgress({ cursorIndex: length, wpm: 70, accuracy: 95, completed: true, finishTimeMs: 30_000 }));
    for (const duel of [host, a]) await waitFor(() => expect(duel.current.duelState).toBe("finished"));

    act(() => a.current.requestRematch());
    for (const duel of [host, a]) await waitFor(() => expect(duel.current.duelState).toBe("lobby"));
    expect(host.current.players.every((item) => !item.ready && !item.completed && item.cursorIndex === 0)).toBe(true);
  }, 15_000);

  it("un-readies guests when the host changes the rules", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    act(() => a.current.toggleReady());
    await waitFor(() => expect(host.current.players[1].ready).toBe(true));
    act(() => host.current.updateLobbyConfig({ ...host.current.duelConfig, mode: "timed", durationSeconds: 15 }));
    await waitFor(() => expect(a.current.duelConfig.mode).toBe("timed"));
    await waitFor(() => expect(a.current.isReady).toBe(false));
  });

  it("turns players away when the room is full", async () => {
    const host = await hostRoom(2);
    await join(host, "Rafi");
    const late = player("Dewi");
    await act(() => late.current.joinRoom(host.current.roomCode));
    await waitFor(() => expect(late.current.error).toBe("That room is full."));
    await waitFor(() => expect(late.current.duelState).toBe("idle"));
    expect(names(host.current)).toEqual(["Host", "Rafi"]);
  });

  it("turns players away while a race is running", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    await startRace([host, a]);
    const late = player("Dewi");
    await act(() => late.current.joinRoom(host.current.roomCode));
    await waitFor(() => expect(late.current.error).toMatch(/race is running/));
  }, 15_000);

  it("lets the host remove a player", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    await waitFor(() => expect(host.current.players).toHaveLength(2));
    act(() => host.current.kickPlayer(a.current.selfId));
    await waitFor(() => expect(a.current.duelState).toBe("idle"));
    expect(a.current.notice).toBe("The host removed you from the room.");
    await waitFor(() => expect(names(host.current)).toEqual(["Host"]));
  });

  it("tells guests when the host leaves", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    act(() => host.current.leaveDuel());
    await waitFor(() => expect(a.current.duelState).toBe("idle"));
    expect(a.current.notice).toBe("The host closed the room.");
  });

  it("drops a guest who leaves and tells the room", async () => {
    const host = await hostRoom();
    const a = await join(host, "Rafi");
    await waitFor(() => expect(host.current.players).toHaveLength(2));
    act(() => a.current.leaveDuel());
    await waitFor(() => expect(host.current.players).toHaveLength(1));
    expect(host.current.notice).toBe("Rafi left the room.");
    expect(host.current.duelState).toBe("lobby");
  });

  it("reports a room code that does not exist", async () => {
    const guest = player("Rafi");
    await act(() => guest.current.joinRoom("NOPE00"));
    await waitFor(() => expect(guest.current.error).toMatch(/Room not found/));
    expect(guest.current.duelState).toBe("idle");
  });

  it("sends a name that arrives after joining", async () => {
    const host = await hostRoom();
    const guest = renderHook(({ name }) => usePeerDuel(name, DEFAULT_DUEL_CONFIG), { initialProps: { name: "Typist" } });
    await act(() => guest.result.current.joinRoom(host.current.roomCode));
    await waitFor(() => expect(names(host.current)).toContain("Typist"));
    guest.rerender({ name: "Rafi" });
    await waitFor(() => expect(names(host.current)).toEqual(["Host", "Rafi"]));
  });
});
