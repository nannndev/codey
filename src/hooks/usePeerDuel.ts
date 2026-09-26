import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { type DataConnection } from "peerjs";
import { getRandomSnippet } from "@/data";
import type { Snippet, SnippetLength, TestMode, TimedDuration } from "@/types";

/**
 * Live duels over WebRTC in a star: every guest connects to the host, and the
 * host owns the room (rules, roster, phase) and relays progress between guests.
 */

export type DuelState = "idle" | "lobby" | "countdown" | "racing" | "finished";

export interface DuelConfig {
  mode: TestMode;
  snippetLength: SnippetLength;
  durationSeconds: TimedDuration;
  selectedLanguage: string;
  maxPlayers: number;
  /** "custom" when the host pasted or imported the code instead of drawing one. */
  codeSource: "random" | "custom";
}

export interface DuelPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  cursorIndex: number;
  wpm: number;
  accuracy: number;
  completed: boolean;
  finishTimeMs?: number;
  /** Joined after the race ended; watches until the next rematch. */
  spectating?: boolean;
}

interface Progress {
  cursorIndex: number;
  wpm: number;
  accuracy: number;
  completed: boolean;
  finishTimeMs?: number;
}

type DuelMessage =
  // guest → host
  | { type: "PROFILE"; name: string }
  | { type: "READY"; ready: boolean }
  | ({ type: "PROGRESS" } & Progress)
  | { type: "REMATCH_REQUEST" }
  // host → guests
  | { type: "ROSTER"; players: DuelPlayer[] }
  | ({ type: "PLAYER_PROGRESS"; id: string } & Progress)
  | { type: "LOBBY"; snippet: Snippet; config: DuelConfig }
  | { type: "START"; snippet: Snippet; config: DuelConfig }
  | { type: "FINISH_WINDOW"; remainingMs: number }
  | { type: "END" }
  | { type: "RESET"; snippet: Snippet; config: DuelConfig }
  | { type: "DENIED"; reason: string }
  | { type: "KICKED" };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** After the first finisher, stragglers get this long before the race closes. */
export const FINISH_WINDOW_MS = 30_000;
/** Custom code is capped so one duel stays a sprint, not a marathon. */
export const MAX_CUSTOM_CHARS = 3000;

export const DEFAULT_DUEL_CONFIG: DuelConfig = {
  mode: "snippet",
  snippetLength: "medium",
  durationSeconds: 30,
  selectedLanguage: "All",
  maxPlayers: 2,
  codeSource: "random",
};

/** Timed runs always use a long snippet so nobody runs out of code before the clock stops. */
export function snippetForConfig(config: DuelConfig): Snippet {
  const language = config.selectedLanguage === "All" ? undefined : config.selectedLanguage;
  return getRandomSnippet(language, config.mode === "timed" ? "long" : config.snippetLength);
}

/** Room codes are "CODEY-" plus six characters; the prefix is optional when typing one. */
export const ROOM_PREFIX = "CODEY-";

export function normalizeRoomCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/\s+/g, "");
  return clean.startsWith(ROOM_PREFIX) ? clean : `${ROOM_PREFIX}${clean}`;
}

// A self-hosted PeerServer can be set with VITE_PEER_HOST; the PeerJS cloud is the default.
const PEER_OPTIONS = import.meta.env.VITE_PEER_HOST
  ? {
      host: import.meta.env.VITE_PEER_HOST as string,
      port: Number(import.meta.env.VITE_PEER_PORT) || 443,
      path: (import.meta.env.VITE_PEER_PATH as string) || "/",
      secure: import.meta.env.VITE_PEER_SECURE !== "false",
    }
  : {};

function describePeerError(error: unknown): string {
  switch ((error as { type?: string })?.type) {
    case "peer-unavailable":
      return "Room not found. Check the code, or ask the host to create the room again.";
    case "unavailable-id":
      return "That room code is already taken. Try creating the room again.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Could not reach the match server. Check your connection and try again.";
    case "browser-incompatible":
      return "This browser does not support live duels (WebRTC).";
    default:
      return "Something went wrong with the connection. Try again.";
  }
}

const freshProgress = { cursorIndex: 0, wpm: 0, accuracy: 100, completed: false, finishTimeMs: undefined };

function newPlayer(id: string, name: string, isHost: boolean): DuelPlayer {
  return { id, name, isHost, ready: false, ...freshProgress };
}

/** The race is decided once at most one racer is still typing; the last place is settled. */
function raceDecided(players: DuelPlayer[], mode: TestMode): boolean {
  const racers = players.filter((player) => !player.spectating);
  if (racers.length === 0) return true;
  const unfinished = racers.filter((player) => !player.completed).length;
  if (mode === "timed" || racers.length === 1) return unfinished === 0;
  return unfinished <= 1;
}

const progressOf = (message: Progress): Progress => ({
  cursorIndex: message.cursorIndex,
  wpm: message.wpm,
  accuracy: message.accuracy,
  completed: message.completed,
  finishTimeMs: message.finishTimeMs,
});

export function usePeerDuel(playerName: string = "Typist", initialConfig: DuelConfig = DEFAULT_DUEL_CONFIG) {
  const [duelState, setDuelState] = useState<DuelState>("idle");
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [selfId, setSelfId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [snippet, setSnippet] = useState<Snippet>(() => getRandomSnippet());
  const [duelConfig, setDuelConfig] = useState<DuelConfig>(initialConfig);
  const [players, setPlayers] = useState<DuelPlayer[]>([]);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [finishDeadline, setFinishDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  /** Host: one connection per guest. Guest: the single connection to the host, keyed by room code. */
  const connsRef = useRef(new Map<string, DataConnection>());
  const isHostRef = useRef(false);
  const leavingRef = useRef(false);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snippetRef = useRef(snippet);
  const configRef = useRef(duelConfig);
  const playersRef = useRef<DuelPlayer[]>([]);
  const stateRef = useRef<DuelState>("idle");
  const nameRef = useRef(playerName);
  nameRef.current = playerName;

  const setPhase = useCallback((next: DuelState) => {
    stateRef.current = next;
    setDuelState(next);
  }, []);

  const applyRules = useCallback((nextSnippet: Snippet, nextConfig: DuelConfig) => {
    snippetRef.current = nextSnippet;
    configRef.current = nextConfig;
    setSnippet(nextSnippet);
    setDuelConfig(nextConfig);
  }, []);

  const setRoster = useCallback((next: DuelPlayer[]) => {
    playersRef.current = next;
    setPlayers(next);
  }, []);

  const send = useCallback((conn: DataConnection | undefined, message: DuelMessage) => {
    if (conn?.open) conn.send(message);
  }, []);

  const broadcast = useCallback((message: DuelMessage, exceptId?: string) => {
    for (const [id, conn] of connsRef.current) if (id !== exceptId) send(conn, message);
  }, [send]);

  /** Host only: replace the roster and push it to every guest. */
  const commitRoster = useCallback((next: DuelPlayer[]) => {
    setRoster(next);
    broadcast({ type: "ROSTER", players: next });
  }, [broadcast, setRoster]);

  const updatePlayer = useCallback((id: string, patch: Partial<DuelPlayer>, { push = true } = {}) => {
    const next = playersRef.current.map((player) => (player.id === id ? { ...player, ...patch } : player));
    if (push && isHostRef.current) commitRoster(next);
    else setRoster(next);
  }, [commitRoster, setRoster]);

  const clearEndTimer = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    setFinishDeadline(null);
  }, []);

  const endRace = useCallback(() => {
    if (!isHostRef.current || stateRef.current !== "racing") return;
    clearEndTimer();
    setPhase("finished");
    broadcast({ type: "END" });
  }, [broadcast, clearEndTimer, setPhase]);

  /** Host: after any progress change, close the race when it is decided or start the straggler window. */
  const checkRaceEnd = useCallback(() => {
    if (!isHostRef.current || stateRef.current !== "racing") return;
    const roster = playersRef.current;
    if (raceDecided(roster, configRef.current.mode)) {
      endRace();
      return;
    }
    if (!endTimerRef.current && roster.some((player) => player.completed)) {
      const windowMs = configRef.current.mode === "timed" ? 5000 : FINISH_WINDOW_MS;
      endTimerRef.current = setTimeout(endRace, windowMs);
      setFinishDeadline(Date.now() + windowMs);
      broadcast({ type: "FINISH_WINDOW", remainingMs: windowMs });
    }
  }, [broadcast, endRace]);

  const resetRoster = useCallback((roster: DuelPlayer[]) =>
    roster.map((player) => ({ ...player, ...freshProgress, ready: false, spectating: false })), []);

  /** Host: back to the lobby with a fresh snippet (or the same custom code). */
  const resetRoom = useCallback((nextSnippet?: Snippet) => {
    if (!isHostRef.current) return;
    clearEndTimer();
    const config = configRef.current;
    const snippetForRematch = nextSnippet ?? (config.codeSource === "custom" ? snippetRef.current : snippetForConfig(config));
    applyRules(snippetForRematch, config);
    setPhase("lobby");
    broadcast({ type: "RESET", snippet: snippetForRematch, config });
    commitRoster(resetRoster(playersRef.current));
  }, [applyRules, broadcast, clearEndTimer, commitRoster, resetRoster, setPhase]);

  const handleGuestMessage = useCallback((guestId: string, message: DuelMessage) => {
    switch (message.type) {
      case "PROFILE":
        updatePlayer(guestId, { name: message.name.slice(0, 40) || "Typist" });
        break;
      case "READY":
        if (stateRef.current === "lobby") updatePlayer(guestId, { ready: message.ready });
        break;
      case "PROGRESS": {
        if (stateRef.current !== "racing") break;
        const progress = progressOf(message);
        updatePlayer(guestId, progress, { push: false });
        broadcast({ type: "PLAYER_PROGRESS", id: guestId, ...progress }, guestId);
        if (progress.completed) checkRaceEnd();
        break;
      }
      case "REMATCH_REQUEST":
        if (stateRef.current === "finished") resetRoom();
        break;
    }
  }, [broadcast, checkRaceEnd, resetRoom, updatePlayer]);

  const handleHostMessage = useCallback((message: DuelMessage) => {
    switch (message.type) {
      case "ROSTER":
        setRoster(message.players);
        break;
      case "PLAYER_PROGRESS": {
        const progress = progressOf(message);
        setRoster(playersRef.current.map((player) => (player.id === message.id ? { ...player, ...progress } : player)));
        break;
      }
      case "LOBBY":
        applyRules(message.snippet, message.config);
        if (stateRef.current === "idle") setPhase("lobby");
        break;
      case "START":
        applyRules(message.snippet, message.config);
        setCountdownSeconds(3);
        setPhase("countdown");
        break;
      case "FINISH_WINDOW":
        setFinishDeadline(Date.now() + message.remainingMs);
        break;
      case "END":
        setFinishDeadline(null);
        setPhase("finished");
        break;
      case "RESET":
        applyRules(message.snippet, message.config);
        setFinishDeadline(null);
        setPhase("lobby");
        break;
      case "DENIED":
        setError(message.reason);
        break;
      case "KICKED":
        setNotice("The host removed you from the room.");
        break;
    }
  }, [applyRules, setPhase, setRoster]);

  const teardown = useCallback(() => {
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    for (const conn of connsRef.current.values()) conn.close();
    connsRef.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
  }, []);

  const resetLocal = useCallback(() => {
    isHostRef.current = false;
    setIsHost(false);
    setRoomCode("");
    setSelfId("");
    setRoster([]);
    setFinishDeadline(null);
    setConnectionStatus("disconnected");
    setPhase("idle");
  }, [setPhase, setRoster]);

  /** Host: accept or turn away a guest's connection. */
  const acceptGuest = useCallback((conn: DataConnection) => {
    conn.on("open", () => {
      const roster = playersRef.current;
      const phase = stateRef.current;
      const reason =
        phase === "countdown" || phase === "racing"
          ? "A race is running in that room. Try again in a moment."
          : roster.length >= configRef.current.maxPlayers
            ? "That room is full."
            : null;
      if (reason) {
        send(conn, { type: "DENIED", reason });
        setTimeout(() => conn.close(), 300);
        return;
      }
      connsRef.current.set(conn.peer, conn);
      const name = String((conn.metadata as { name?: string } | undefined)?.name ?? "Typist").slice(0, 40);
      const guest = { ...newPlayer(conn.peer, name, false), spectating: phase === "finished" };
      send(conn, { type: "LOBBY", snippet: snippetRef.current, config: configRef.current });
      commitRoster([...roster, guest]);
      setConnectionStatus("connected");
    });
    conn.on("data", (data) => handleGuestMessage(conn.peer, data as DuelMessage));
    conn.on("close", () => {
      if (connsRef.current.get(conn.peer) !== conn) return;
      connsRef.current.delete(conn.peer);
      if (leavingRef.current) return;
      const leaving = playersRef.current.find((player) => player.id === conn.peer);
      commitRoster(playersRef.current.filter((player) => player.id !== conn.peer));
      if (leaving) setNotice(`${leaving.name} left the room.`);
      if (connsRef.current.size === 0) setConnectionStatus("connecting");
      checkRaceEnd();
    });
  }, [checkRaceEnd, commitRoster, handleGuestMessage, send]);

  const initPeer = useCallback((customId?: string): Promise<Peer> => {
    return new Promise((resolve, reject) => {
      const id = (customId || `CODEY-${Math.random().toString(36).substring(2, 8)}`).toUpperCase();
      const peer = new Peer(id, { debug: 1, ...PEER_OPTIONS });
      peerRef.current = peer;
      peer.on("open", () => resolve(peer));
      peer.on("connection", (conn) => {
        if (isHostRef.current) acceptGuest(conn);
        else conn.close();
      });
      peer.on("error", (peerError) => {
        console.error("PeerJS Error:", peerError);
        if (peerRef.current !== peer) return;
        if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
        setError(describePeerError(peerError));
        // A host keeps its room when a lookup fails; everything else ends the session.
        if (!isHostRef.current || (peerError as { type?: string }).type !== "peer-unavailable") {
          teardown();
          resetLocal();
        }
        reject(peerError);
      });
    });
  }, [acceptGuest, resetLocal, teardown]);

  const createRoom = useCallback(async (selectedSnippet?: Snippet, selectedConfig?: DuelConfig) => {
    teardown();
    leavingRef.current = false;
    setError(null);
    setNotice(null);
    isHostRef.current = true;
    setIsHost(true);
    setConnectionStatus("connecting");
    const config = selectedConfig ?? configRef.current;
    applyRules(selectedSnippet ?? snippetForConfig(config), config);
    try {
      const peer = await initPeer();
      const code = peer.id.toUpperCase();
      setRoomCode(code);
      setSelfId(code);
      setRoster([newPlayer(code, nameRef.current, true)]);
      setPhase("lobby");
    } catch {
      // initPeer reported the error.
    }
  }, [applyRules, initPeer, setPhase, setRoster, teardown]);

  const joinRoom = useCallback(async (code: string) => {
    teardown();
    leavingRef.current = false;
    setError(null);
    setNotice(null);
    isHostRef.current = false;
    setIsHost(false);
    setConnectionStatus("connecting");
    let peer: Peer;
    try {
      peer = await initPeer();
    } catch {
      return;
    }
    const target = normalizeRoomCode(code);
    setRoomCode(target);
    setSelfId(peer.id.toUpperCase());
    const conn = peer.connect(target, { reliable: true, metadata: { name: nameRef.current } });
    connsRef.current.set(target, conn);
    conn.on("open", () => {
      if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
      setConnectionStatus("connected");
    });
    conn.on("data", (data) => handleHostMessage(data as DuelMessage));
    conn.on("close", () => {
      if (connsRef.current.get(target) !== conn) return;
      connsRef.current.delete(target);
      if (leavingRef.current) return;
      setNotice((current) => current ?? "The host closed the room.");
      teardown();
      resetLocal();
    });
    joinTimerRef.current = setTimeout(() => {
      if (conn.open) return;
      setError("The room did not answer. Check the code and try again.");
      teardown();
      resetLocal();
    }, 12000);
  }, [handleHostMessage, initPeer, resetLocal, teardown]);

  const toggleReady = useCallback(() => {
    const me = playersRef.current.find((player) => player.id === selfId);
    if (!me || stateRef.current !== "lobby") return;
    const ready = !me.ready;
    if (isHostRef.current) {
      updatePlayer(selfId, { ready });
    } else {
      // Optimistic; the host's roster confirms it.
      updatePlayer(selfId, { ready }, { push: false });
      send(connsRef.current.get(roomCode), { type: "READY", ready });
    }
  }, [roomCode, selfId, send, updatePlayer]);

  const startMatch = useCallback(() => {
    if (!isHostRef.current || stateRef.current !== "lobby") return;
    const roster = resetRoster(playersRef.current).map((player) => ({ ...player, ready: true }));
    commitRoster(roster);
    broadcast({ type: "START", snippet: snippetRef.current, config: configRef.current });
    setCountdownSeconds(3);
    setPhase("countdown");
  }, [broadcast, commitRoster, resetRoster, setPhase]);

  useEffect(() => {
    if (duelState !== "countdown") return;
    if (countdownSeconds > 0) {
      const timer = setTimeout(() => setCountdownSeconds((seconds) => seconds - 1), 1000);
      return () => clearTimeout(timer);
    }
    setPhase("racing");
  }, [duelState, countdownSeconds, setPhase]);

  /** Reports this player's progress; the host relays it to everyone else. */
  const sendProgress = useCallback((progress: Progress) => {
    if (stateRef.current !== "racing") return;
    updatePlayer(selfId, progress, { push: false });
    if (isHostRef.current) {
      broadcast({ type: "PLAYER_PROGRESS", id: selfId, ...progress });
      if (progress.completed) checkRaceEnd();
    } else {
      send(connsRef.current.get(roomCode), { type: "PROGRESS", ...progress });
    }
  }, [broadcast, checkRaceEnd, roomCode, selfId, send, updatePlayer]);

  /** Host: new rules; everyone re-confirms so nobody races something they did not agree to. */
  const updateLobbyConfig = useCallback((newConfig: DuelConfig, newSnippet?: Snippet) => {
    applyRules(newSnippet ?? snippetRef.current, newConfig);
    if (!isHostRef.current || stateRef.current !== "lobby") return;
    broadcast({ type: "LOBBY", snippet: snippetRef.current, config: newConfig });
    let roster = playersRef.current.map((player) => (player.isHost ? player : { ...player, ready: false }));
    // Shrinking the room keeps the earliest players.
    if (roster.length > newConfig.maxPlayers) {
      for (const player of roster.slice(newConfig.maxPlayers)) {
        const conn = connsRef.current.get(player.id);
        send(conn, { type: "DENIED", reason: "The host made the room smaller." });
        setTimeout(() => conn?.close(), 300);
      }
      roster = roster.slice(0, newConfig.maxPlayers);
    }
    commitRoster(roster);
  }, [applyRules, broadcast, commitRoster, send]);

  const requestRematch = useCallback(() => {
    if (isHostRef.current) resetRoom();
    else send(connsRef.current.get(roomCode), { type: "REMATCH_REQUEST" });
  }, [resetRoom, roomCode, send]);

  const kickPlayer = useCallback((id: string) => {
    if (!isHostRef.current) return;
    const conn = connsRef.current.get(id);
    send(conn, { type: "KICKED" });
    setTimeout(() => conn?.close(), 200);
  }, [send]);

  // The name can arrive after the connection (auth loads late on invite links), so resend it.
  useEffect(() => {
    if (!selfId) return;
    if (isHostRef.current) {
      if (playersRef.current.some((player) => player.id === selfId && player.name !== playerName)) updatePlayer(selfId, { name: playerName });
    } else if (connectionStatus === "connected") {
      send(connsRef.current.get(roomCode), { type: "PROFILE", name: playerName });
    }
  }, [connectionStatus, playerName, roomCode, selfId, send, updatePlayer]);

  const leaveDuel = useCallback(() => {
    leavingRef.current = true;
    teardown();
    resetLocal();
    setError(null);
    setNotice(null);
  }, [resetLocal, teardown]);

  // Release the room code when the page unmounts.
  useEffect(() => () => {
    leavingRef.current = true;
    teardown();
  }, [teardown]);

  const clearNotice = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const me = players.find((player) => player.id === selfId);

  return {
    duelState,
    isHost,
    roomCode,
    selfId,
    connectionStatus,
    snippet,
    duelConfig,
    players,
    isReady: Boolean(me?.ready),
    countdownSeconds,
    finishDeadline,
    error,
    notice,
    clearNotice,
    createRoom,
    joinRoom,
    toggleReady,
    startMatch,
    sendProgress,
    updateLobbyConfig,
    requestRematch,
    kickPlayer,
    leaveDuel,
  };
}
