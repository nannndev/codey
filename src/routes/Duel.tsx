import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Flame,
  Globe2,
  History,
  Link2,
  Loader2,
  LogOut,
  MinusCircle,
  Play,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CodeDisplay } from "@/components/CodeDisplay";
import { useAuth } from "@/components/AuthProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import { Avatar, MatchRules, OpenRooms, RaceLane, Seat, VisibilityToggle, ordinal, seatTone, segment } from "@/components/duel/DuelParts";
import {
  DEFAULT_DUEL_CONFIG,
  MIN_PLAYERS,
  ROOM_PREFIX,
  snippetForConfig,
  usePeerDuel,
  type DuelConfig,
  type DuelPlayer,
} from "@/hooks/usePeerDuel";
import { useKeyboardSound } from "@/hooks/useKeyboardSound";
import { getLanguages, maxSnippetCharsForLanguage } from "@/data";
import { publishRoom, unpublishRoom, type PublicRoom } from "@/lib/duel-rooms";
import { checkAchievements } from "@/lib/achievement-snapshot";
import { cn } from "@/lib/utils";
import { SNIPPET_LENGTH_SPEC } from "@/utils/ranking";
import { computeCharStates, computeWpm } from "@/utils";
import { getDuelHistory, saveDuelRecord, getDuelStats, type DuelRecord } from "@/utils/duel-history";
import type { Snippet, SnippetLength, TestMode } from "@/types";

/** Finishers by time, then everyone else by how far they got; timed races by speed. */
function rankPlayers(players: DuelPlayer[], mode: TestMode): DuelPlayer[] {
  return [...players].sort((a, b) => {
    if (mode === "timed") return b.wpm - a.wpm || b.cursorIndex - a.cursorIndex;
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    if (a.completed) return (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity);
    return b.cursorIndex - a.cursorIndex;
  });
}

/** Re-renders every `ms` while `active`, for countdown labels. */
function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
  return now;
}

const LENGTHS: SnippetLength[] = ["short", "medium", "long"];

export default function Duel() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const playerName = user?.name || "Typist";
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"arena" | "history">("arena");
  const [history, setHistory] = useState<DuelRecord[]>([]);
  const [stats, setStats] = useState(getDuelStats());
  const savedRecordRef = useRef(false);

  const playSound = useKeyboardSound(
    preferences.keyboardSound,
    preferences.keyboardSoundProfile,
    preferences.keyboardSoundVolume,
    preferences.keyboardSoundTuning
  );

  const duel = usePeerDuel(playerName, DEFAULT_DUEL_CONFIG);
  const {
    duelState,
    isHost,
    roomCode,
    selfId,
    connectionStatus,
    snippet,
    duelConfig,
    players,
    isReady,
    countdownSeconds,
    finishDeadline,
    createRoom,
    joinRoom,
    toggleReady,
    startMatch,
    sendProgress,
    updateLobbyConfig,
    requestRematch,
    kickPlayer,
    leaveDuel,
  } = duel;
  const { mode, snippetLength, durationSeconds, selectedLanguage, maxPlayers } = duelConfig;

  const [inputCode, setInputCode] = useState(() => (searchParams.get("room") ?? "").toUpperCase().replace(ROOM_PREFIX, ""));
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [myWpm, setMyWpm] = useState(0);
  const [myAcc, setMyAcc] = useState(100);
  const [myFinished, setMyFinished] = useState(false);
  const [myFinishTimeMs, setMyFinishTimeMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [rematchSent, setRematchSent] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const languages = getLanguages();

  // Latest stats, so the timed-mode countdown can finish the race without stale closures.
  const liveStatsRef = useRef({ cursorIndex: 0, wpm: 0, accuracy: 100 });
  liveStatsRef.current = { cursorIndex: typedText.length, wpm: myWpm, accuracy: myAcc };

  useEffect(() => {
    setHistory(getDuelHistory());
    setStats(getDuelStats());
  }, []);

  // Invite links (/duel?room=CODE) join the room as soon as the page opens.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    const room = searchParams.get("room");
    if (!room || autoJoinedRef.current) return;
    // Deferred a tick so a StrictMode remount cancels the first attempt instead of orphaning it.
    const timer = setTimeout(() => {
      autoJoinedRef.current = true;
      void joinRoom(room);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchParams, joinRoom]);

  const charStates = useMemo(() => computeCharStates(snippet.code, typedText), [snippet.code, typedText]);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      hiddenInputRef.current?.focus();
      editorContainerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (duelState === "racing") {
      setTypedText("");
      setStartTime(Date.now());
      setMyWpm(0);
      setMyAcc(100);
      setMyFinished(false);
      setMyFinishTimeMs(null);
      setSecondsLeft(mode === "timed" ? durationSeconds : null);
      savedRecordRef.current = false;
      focusEditor();
    }
    if (duelState === "lobby" || duelState === "idle" || duelState === "countdown") {
      setMyFinished(false);
      setMyFinishTimeMs(null);
      setSecondsLeft(null);
      setTypedText("");
      setMyWpm(0);
      setMyAcc(100);
      setRematchSent(false);
    }
  }, [duelState, focusEditor, mode, durationSeconds]);

  const racers = players.filter((player) => !player.spectating);
  const everyoneReady = racers.length >= MIN_PLAYERS && racers.every((player) => player.ready);

  // The host starts the countdown once everyone in the room is ready; no extra click.
  useEffect(() => {
    if (!isHost || duelState !== "lobby" || !everyoneReady) return;
    const timer = setTimeout(startMatch, 900);
    return () => clearTimeout(timer);
  }, [isHost, duelState, everyoneReady, startMatch]);

  const finish = useCallback((cursorIndex: number, wpm: number, accuracy: number, elapsedMs: number) => {
    setMyFinished(true);
    setMyFinishTimeMs(elapsedMs);
    sendProgress({ cursorIndex, wpm, accuracy, completed: true, finishTimeMs: elapsedMs });
  }, [sendProgress]);

  // Timed mode: tick the clock down and stop at zero.
  useEffect(() => {
    if (duelState !== "racing" || mode !== "timed" || myFinished || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      const elapsedMs = startTime ? Math.max(1000, Date.now() - startTime) : durationSeconds * 1000;
      const { cursorIndex, wpm, accuracy } = liveStatsRef.current;
      finish(cursorIndex, wpm, accuracy, elapsedMs);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [duelState, mode, myFinished, secondsLeft, startTime, durationSeconds, finish]);

  // This player's row uses local numbers so it never lags behind the keyboard.
  const livePlayers = useMemo(
    () =>
      players.map((player) =>
        player.id === selfId
          ? { ...player, cursorIndex: typedText.length, wpm: myWpm, accuracy: myAcc, completed: myFinished, finishTimeMs: myFinishTimeMs ?? undefined }
          : player
      ),
    [players, selfId, typedText.length, myWpm, myAcc, myFinished, myFinishTimeMs]
  );
  const standings = useMemo(() => rankPlayers(livePlayers.filter((player) => !player.spectating), mode), [livePlayers, mode]);
  const myPlace = standings.findIndex((player) => player.id === selfId) + 1;
  const iRaced = myPlace > 0;
  const raceClosed = duelState === "finished";
  const others = livePlayers.filter((player) => player.id !== selfId);
  const soloRival = racers.length === 2 ? others.find((player) => !player.spectating) : undefined;

  const outcome = useMemo<DuelRecord["outcome"] | null>(() => {
    if (!raceClosed || !iRaced) return null;
    const [first, second] = standings;
    const tied =
      second &&
      (mode === "timed"
        ? Math.round(first.wpm * 10) === Math.round(second.wpm * 10)
        : first.completed && second.completed && first.finishTimeMs === second.finishTimeMs);
    if (tied && (first.id === selfId || second.id === selfId)) return "draw";
    return myPlace === 1 ? "victory" : "defeat";
  }, [raceClosed, iRaced, standings, mode, selfId, myPlace]);

  useEffect(() => {
    if (!outcome || savedRecordRef.current || (myWpm === 0 && others.every((player) => player.wpm === 0))) return;
    savedRecordRef.current = true;
    const rivals = standings.filter((player) => player.id !== selfId);
    const best = rivals[0];
    const record: DuelRecord = {
      id: `duel-${Date.now()}`,
      timestamp: Date.now(),
      opponentName: rivals.length === 1 ? rivals[0].name : `${rivals.length} players`,
      myWpm,
      oppWpm: best?.wpm ?? 0,
      myAccuracy: myAcc,
      oppAccuracy: best?.accuracy ?? 100,
      language: snippet.language,
      outcome,
      placement: myPlace,
      playerCount: standings.length,
    };
    setHistory(saveDuelRecord(record));
    checkAchievements(user?.$id);
    setStats(getDuelStats());
  }, [outcome, myWpm, myAcc, others, standings, selfId, snippet.language, myPlace, user?.$id]);

  function handleEditorKeyDown(e: React.KeyboardEvent) {
    if (duelState !== "racing" || myFinished) return;

    if (e.key === "Tab" || e.key === "Enter" || e.key === "Backspace" || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      return;
    }

    let nextInput = typedText;
    const currentPos = typedText.length;
    const expectedChar = snippet.code[currentPos];

    // Never let the buffer grow past the target — the race ends at the last char.
    if (e.key !== "Backspace" && currentPos >= snippet.code.length) return;

    if (e.key === "Backspace") {
      if (typedText.length > 0) {
        nextInput = typedText.slice(0, -1);
        playSound("Backspace");
      }
    } else if (e.key === "Enter") {
      nextInput = typedText + "\n";
      playSound("Enter");
    } else if (e.key === "Tab") {
      if (expectedChar === "\t") nextInput = typedText + "\t";
      else if (snippet.code.slice(currentPos, currentPos + 2) === "  ") nextInput = typedText + "  ";
      else nextInput = typedText + " ";
      playSound("Tab");
    } else {
      nextInput = typedText + e.key;
      playSound(e.key);
    }

    setTypedText(nextInput);

    const elapsedMs = startTime ? Math.max(1000, Date.now() - startTime) : 1000;
    let correctCount = 0;
    for (let i = 0; i < nextInput.length; i++) {
      if (nextInput[i] === snippet.code[i]) correctCount++;
    }
    const currentWpm = computeWpm(correctCount, elapsedMs);
    const currentAcc = nextInput.length === 0 ? 100 : Math.round((correctCount / nextInput.length) * 100);
    setMyWpm(currentWpm);
    setMyAcc(currentAcc);

    // Reaching the end of the snippet ends the run, typos included — matching the solo game.
    if (nextInput.length >= snippet.code.length) {
      finish(nextInput.length, currentWpm, currentAcc, elapsedMs);
      return;
    }
    sendProgress({ cursorIndex: nextInput.length, wpm: currentWpm, accuracy: currentAcc, completed: false });
  }

  const inviteLink = roomCode ? `${window.location.origin}/duel?room=${roomCode.replace(ROOM_PREFIX, "")}` : "";

  function copy(kind: "link" | "code") {
    void navigator.clipboard?.writeText(kind === "link" ? inviteLink : roomCode);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handleCreate(config = duelConfig, publicRoom = isPublic) {
    setCreating(true);
    setLocalNotice(null);
    setIsPublic(publicRoom);
    await createRoom(config.codeSource === "custom" ? snippet : snippetForConfig(config), config);
    setCreating(false);
  }

  function handleJoin(code = inputCode) {
    if (!code.trim()) return;
    setLocalNotice(null);
    void joinRoom(code);
  }

  function handleQuickMatch(rooms: PublicRoom[]) {
    // The list is sorted fullest first, so the top room is the one closest to starting.
    const pick = rooms[0];
    if (pick) {
      handleJoin(pick.code);
      return;
    }
    if (!user) {
      setLocalNotice("No open rooms right now. Sign in to host a public room, or create a private one and share the link.");
      return;
    }
    const config = { ...duelConfig, maxPlayers: Math.max(duelConfig.maxPlayers, 4) };
    updateLobbyConfig(config);
    void handleCreate(config, true);
  }

  function handleLeave() {
    leaveDuel();
    if (searchParams.has("room")) setSearchParams({}, { replace: true });
  }

  // The static pool is small, so some lengths cannot be built for some languages.
  const unavailableLengths = useMemo(() => {
    const budget = maxSnippetCharsForLanguage(selectedLanguage === "All" ? undefined : selectedLanguage);
    return new Set(LENGTHS.filter((len) => budget < SNIPPET_LENGTH_SPEC[len].minChars));
  }, [selectedLanguage]);

  // Random code redraws on every rule change; custom code stays until the host switches back.
  const changeRules = (next: DuelConfig) => updateLobbyConfig(next, next.codeSource === "custom" ? snippet : snippetForConfig(next));
  const applyCustomCode = (custom: Snippet) => updateLobbyConfig({ ...duelConfig, codeSource: "custom" }, { ...custom, id: `custom-${Date.now()}` });

  // Public rooms: keep the listing fresh while the room exists; remove it when it closes.
  const listing = useMemo(() => ({
    code: roomCode,
    language: snippet.language,
    mode: mode === "timed" ? ("timed" as const) : ("snippet" as const),
    detail: mode === "timed" ? `${durationSeconds}s` : duelConfig.codeSource === "custom" ? `${snippet.code.length} chars` : snippetLength,
    players: players.length,
    maxPlayers,
    status: duelState === "countdown" || duelState === "racing" ? ("racing" as const) : ("lobby" as const),
    custom: duelConfig.codeSource === "custom",
  }), [roomCode, snippet.language, snippet.code.length, mode, durationSeconds, snippetLength, players.length, maxPlayers, duelState, duelConfig.codeSource]);
  const listed = isHost && isPublic && Boolean(user) && Boolean(roomCode) && duelState !== "idle";
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!listed) return;
    const push = () => publishRoom(listing).then(() => setPublishError(null), (err: Error) => setPublishError(err.message));
    void push();
    const timer = setInterval(push, 20_000);
    return () => clearInterval(timer);
  }, [listed, listing]);

  useEffect(() => {
    if (!listed) return;
    const code = roomCode;
    return () => {
      void unpublishRoom(code, { keepalive: true }).catch(() => undefined);
    };
  }, [listed, roomCode]);

  const targetCode = snippet.code;
  const percentOf = (chars: number) => Math.min(100, (chars / Math.max(1, targetCode.length)) * 100);
  const joining = duelState === "idle" && connectionStatus === "connecting";
  const inMatch = duelState === "countdown" || duelState === "racing" || duelState === "finished";
  const custom = duelConfig.codeSource === "custom";
  const rulesLabel = `${snippet.language} · ${mode === "timed" ? `${durationSeconds}s timed` : custom ? "full code" : `${snippetLength} snippet`}${custom ? " · custom code" : ""}`;
  const now = useNow(finishDeadline !== null);
  const windowLeft = finishDeadline ? Math.max(0, Math.ceil((finishDeadline - now) / 1000)) : null;
  const notice = duel.error ?? duel.notice ?? localNotice;
  const readyCount = racers.filter((player) => player.ready).length;
  const hostName = players.find((player) => player.isHost)?.name ?? "the host";

  const marginText = (() => {
    if (!outcome) return "";
    if (soloRival) {
      if (mode === "timed") {
        const diff = Math.abs(myWpm - soloRival.wpm);
        return outcome === "draw" ? "Dead even on speed." : `${outcome === "victory" ? "Won" : "Lost"} by ${diff.toFixed(1)} WPM`;
      }
      if (myFinishTimeMs !== null && soloRival.completed && soloRival.finishTimeMs !== undefined) {
        const diff = Math.abs(myFinishTimeMs - soloRival.finishTimeMs) / 1000;
        return outcome === "draw" ? "Photo finish." : `${outcome === "victory" ? "Won" : "Lost"} by ${diff.toFixed(2)}s`;
      }
      return outcome === "victory"
        ? `First to the end. ${soloRival.name} was at ${Math.round(percentOf(soloRival.cursorIndex))}%.`
        : `${soloRival.name} finished first. You were at ${Math.round(percentOf(typedText.length))}%.`;
    }
    const [first, second] = standings;
    if (myPlace === 1 && second) {
      if (mode === "timed") return `1st of ${standings.length} · ${(first.wpm - second.wpm).toFixed(1)} WPM ahead of ${second.name}`;
      return second.completed && first.finishTimeMs !== undefined && second.finishTimeMs !== undefined
        ? `1st of ${standings.length} · ${((second.finishTimeMs - first.finishTimeMs) / 1000).toFixed(2)}s ahead of ${second.name}`
        : `1st of ${standings.length} · first to the end`;
    }
    return `${ordinal(myPlace)} of ${standings.length} · ${first?.name ?? ""} took the win`;
  })();

  // Seats in join order; open seats fill the rest of the room.
  const seats: (DuelPlayer | undefined)[] = [...players, ...Array.from({ length: Math.max(0, maxPlayers - players.length) }, () => undefined)];
  const oneOnOne = maxPlayers === 2;

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />

        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to typing
        </Link>

        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
              <Swords className="size-3.5" /> Live · up to 6 players
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Duel</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Race friends or anyone online on the same code in real time. Peer to peer, no account needed to play.
            </p>
          </div>

          <div className="flex shrink-0 rounded-xl border border-border/60 bg-card/70 p-1 text-xs">
            <button type="button" onClick={() => setActiveTab("arena")} className={cn(segment(activeTab === "arena"), "px-3.5")}>
              <Swords className="size-3.5" /> Arena
            </button>
            <button type="button" onClick={() => setActiveTab("history")} className={cn(segment(activeTab === "history"), "px-3.5")}>
              <History className="size-3.5" /> History
              <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{stats.total}</span>
            </button>
          </div>
        </header>

        {notice && activeTab === "arena" && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm animate-fade-in">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1">{notice}</p>
            <button type="button" onClick={() => { duel.clearNotice(); setLocalNotice(null); }} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Trophy, tone: "text-amber-500", value: `${stats.wins}`, sub: `/ ${stats.total}`, label: `Wins · ${stats.winRate}%` },
                { icon: Flame, tone: "text-orange-500", value: `${stats.currentStreak}`, label: "Win streak" },
                { icon: Zap, tone: "text-sky-500", value: stats.bestWpm.toFixed(1), label: "Best duel WPM" },
                { icon: Swords, tone: "text-rose-500", value: `${stats.losses}`, label: "Losses" },
              ].map(({ icon: Icon, tone, value, sub, label }) => (
                <div key={label} className="rounded-2xl border bg-card/80 p-4">
                  <Icon className={cn("mb-2 size-4.5", tone)} />
                  <div className="font-mono text-2xl font-black tabular-nums sm:text-3xl">
                    {value} {sub && <span className="text-xs font-medium text-muted-foreground">{sub}</span>}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card/80">
              <div className="border-b bg-muted/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent duels</div>
              {history.length === 0 ? (
                <div className="grid h-40 place-items-center px-5 text-center text-sm text-muted-foreground">No duels yet. Create a room and send the link to a friend.</div>
              ) : (
                <div className="max-h-[420px] divide-y divide-border/40 overflow-y-auto">
                  {history.map((record) => {
                    const tone = record.outcome === "victory" ? "text-emerald-600 dark:text-emerald-400" : record.outcome === "draw" ? "text-muted-foreground" : "text-rose-500";
                    const Icon = record.outcome === "victory" ? CheckCircle2 : record.outcome === "draw" ? MinusCircle : XCircle;
                    const diff = record.myWpm - record.oppWpm;
                    const multi = (record.playerCount ?? 2) > 2;
                    return (
                      <div key={record.id} className="grid grid-cols-[72px_1fr_auto_64px] items-center gap-3 px-5 py-3 text-xs transition-colors hover:bg-muted/30">
                        <span className={cn("flex items-center gap-1.5 text-[11px] font-black uppercase", tone)}>
                          <Icon className="size-4" />
                          {multi && record.placement ? ordinal(record.placement) : record.outcome === "victory" ? "Win" : record.outcome === "draw" ? "Draw" : "Loss"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">vs {record.opponentName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {record.language} · {new Date(record.timestamp).toLocaleDateString()}
                            {multi && ` · ${record.playerCount} racers`}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <p className="font-bold">{record.myWpm.toFixed(1)} wpm</p>
                          <p className="text-[10px] text-muted-foreground">{multi ? "best rival" : "vs"} {record.oppWpm.toFixed(1)}</p>
                        </div>
                        <span className={cn("text-right font-mono font-bold tabular-nums", tone)}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "arena" && (
          <div className="space-y-5">
            {/* ──── IDLE: host, join, or browse open rooms ──── */}
            {duelState === "idle" && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
                  <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-card/80 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Swords className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-extrabold">Host a room</h2>
                        <p className="text-xs text-muted-foreground">Pick the rules and the code, then invite people or open it to everyone.</p>
                      </div>
                    </div>
                    <MatchRules
                      config={duelConfig}
                      snippet={snippet}
                      onChange={changeRules}
                      onCustom={applyCustomCode}
                      languages={languages}
                      unavailableLengths={unavailableLengths}
                    />
                    <VisibilityToggle isPublic={isPublic} onChange={setIsPublic} canPublish={Boolean(user)} />
                    <button
                      type="button"
                      onClick={() => void handleCreate()}
                      disabled={creating}
                      className="mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-black text-zinc-950 shadow-sm transition-colors hover:bg-amber-400 disabled:opacity-70 cursor-pointer"
                    >
                      {creating ? <Loader2 className="size-4 animate-spin" /> : isPublic ? <Globe2 className="size-4" /> : <Play className="size-4 fill-current" />}
                      {creating ? "Opening room…" : isPublic ? "Open public room" : "Create private room"}
                    </button>
                  </section>

                  <section className="flex flex-col gap-4 rounded-2xl border border-sky-500/30 bg-card/80 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <Users className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-extrabold">Join with a code</h2>
                        <p className="text-xs text-muted-foreground">Open your friend's invite link, or type the room code.</p>
                      </div>
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleJoin();
                      }}
                    >
                      <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-background/80 font-mono text-sm font-bold focus-within:ring-2 focus-within:ring-sky-500/60">
                        <span className="select-none pl-3.5 text-muted-foreground">{ROOM_PREFIX}</span>
                        <input
                          type="text"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={12}
                          placeholder="X8K2QA"
                          value={inputCode}
                          onChange={(event) => setInputCode(event.target.value.toUpperCase().replace(ROOM_PREFIX, "").replace(/[^A-Z0-9]/g, ""))}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label="Room code"
                          className="h-full min-w-0 flex-1 bg-transparent pr-3 uppercase tracking-[0.2em] placeholder:text-muted-foreground/40 focus:outline-none"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={!inputCode.trim() || joining}
                        className="flex h-11 items-center gap-1.5 rounded-xl bg-sky-500 px-5 text-sm font-black text-zinc-950 transition-colors hover:bg-sky-400 disabled:opacity-40 cursor-pointer"
                      >
                        {joining && <Loader2 className="size-4 animate-spin" />}
                        {joining ? "Joining" : "Join"}
                      </button>
                    </form>
                    <ol className="mt-auto space-y-1.5 text-xs text-muted-foreground">
                      {["Host a room, or join one from the list below.", "Everyone presses Ready.", "The race starts on its own. Fastest to the end wins."].map((step, index) => (
                        <li key={step} className="flex items-center gap-2.5">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] font-bold text-foreground">{index + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>

                <OpenRooms onJoin={handleJoin} onQuickMatch={handleQuickMatch} busy={joining || creating} />
              </div>
            )}

            {/* ──── LOBBY ──── */}
            {duelState === "lobby" && (
              <div className="space-y-4 rounded-2xl border bg-card/80 p-4 animate-fade-in sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Room
                      {isHost && listed && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                          <Globe2 className="size-3" /> Public
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xl font-black tracking-widest sm:text-2xl">{roomCode}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copy("link")}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-xs font-bold text-background transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      {copied === "link" ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                      {copied === "link" ? "Link copied" : "Copy invite link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy("code")}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-border/70 px-3 text-xs font-semibold transition-colors hover:bg-muted cursor-pointer"
                    >
                      {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied === "code" ? "Copied" : "Code"}
                    </button>
                    <button
                      type="button"
                      onClick={handleLeave}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-border/70 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                    >
                      <LogOut className="size-3.5" /> Leave
                    </button>
                  </div>
                </div>

                {oneOnOne ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                    {[seats[0], seats[1]].map((player, index) => (
                      <div key={player?.id ?? `open-${index}`} className={index === 1 ? "order-3" : undefined}>
                        <Seat
                          player={player}
                          solid={player ? seatTone(players, player.id, selfId).solid : ""}
                          label={player ? `${player.id === selfId ? "You" : player.isHost ? "Host" : "Player"}` : undefined}
                          onKick={isHost && player && player.id !== selfId ? () => kickPlayer(player.id) : undefined}
                          onInvite={() => copy("link")}
                          inviteCopied={copied === "link"}
                        />
                      </div>
                    ))}
                    <span className="order-2 select-none text-2xl font-black italic text-muted-foreground/70 sm:text-4xl">VS</span>
                  </div>
                ) : (
                  <div className={cn("grid gap-3", maxPlayers <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
                    {seats.map((player, index) => (
                      <Seat
                        key={player?.id ?? `open-${index}`}
                        player={player}
                        solid={player ? seatTone(players, player.id, selfId).solid : ""}
                        label={player ? (player.id === selfId ? "You" : player.isHost ? "Host" : undefined) : undefined}
                        onKick={isHost && player && player.id !== selfId ? () => kickPlayer(player.id) : undefined}
                        onInvite={() => copy("link")}
                        inviteCopied={copied === "link"}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2.5 rounded-xl border border-border/50 bg-background/40 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold">
                      <Code2 className="size-3.5 text-amber-500" /> Rules
                      <span className="font-normal text-muted-foreground">{isHost ? "· you set these" : `· set by ${hostName}`}</span>
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{rulesLabel} · {snippet.code.length} chars</p>
                  </div>
                  {isHost ? (
                    <>
                      <MatchRules
                        config={duelConfig}
                        snippet={snippet}
                        onChange={changeRules}
                        onShuffle={() => updateLobbyConfig({ ...duelConfig, codeSource: "random" }, snippetForConfig(duelConfig))}
                        onCustom={applyCustomCode}
                        languages={languages}
                        unavailableLengths={unavailableLengths}
                      />
                      <VisibilityToggle isPublic={isPublic} onChange={setIsPublic} canPublish={Boolean(user)} />
                      {publishError && isPublic && <p className="text-[11px] text-rose-500">Could not list the room: {publishError}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Everyone types the exact same code. If the host changes the rules, you are un-readied so nothing starts by surprise.</p>
                  )}
                  {isHost && mode === "snippet" && duelConfig.codeSource === "random" && unavailableLengths.has(snippetLength) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">* Limited {selectedLanguage} snippets. This race is {snippet.code.length} characters.</p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleReady}
                    disabled={players.length < MIN_PLAYERS}
                    className={cn(
                      "flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                      isReady ? "border border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    )}
                  >
                    {isReady ? <Check className="size-4" strokeWidth={3} /> : <Play className="size-4 fill-current" />}
                    {isReady ? "Ready. Click to cancel" : "I'm ready"}
                  </button>
                  <p className="text-center text-xs text-muted-foreground" aria-live="polite">
                    {players.length < MIN_PLAYERS
                      ? isHost && listed ? "Listed in Open rooms. Waiting for someone to join…" : "Waiting for players to join."
                      : everyoneReady
                        ? "Everyone is ready. Starting…"
                        : `${players.length}/${maxPlayers} players · ${readyCount} ready. The race starts when everyone is ready.`}
                  </p>
                </div>
              </div>
            )}

            {/* ──── COUNTDOWN, RACE, RESULT ──── */}
            {inMatch && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-2xl border bg-card/80 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-[11px] text-muted-foreground">{rulesLabel} · {snippet.code.length} chars</p>
                    <div className="flex items-center gap-3">
                      {duelState === "racing" && iRaced && (
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", myPlace === 1 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                          {myFinished ? `Finished ${ordinal(myPlace)}` : `${ordinal(myPlace)} of ${standings.length}`}
                        </span>
                      )}
                      {windowLeft !== null && duelState === "racing" && (
                        <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          <Timer className="size-3" /> Closes in {windowLeft}s
                        </span>
                      )}
                      {mode === "timed" && (
                        <span className={cn("flex items-center gap-1 font-mono text-lg font-black tabular-nums", secondsLeft !== null && secondsLeft <= 5 ? "text-rose-500" : "text-foreground")}>
                          <Timer className="size-4" /> {secondsLeft ?? durationSeconds}s
                        </span>
                      )}
                    </div>
                  </div>
                  {[...livePlayers.filter((player) => player.id === selfId), ...others].map((player) => {
                    const tone = seatTone(players, player.id, selfId);
                    const place = standings.findIndex((entry) => entry.id === player.id) + 1;
                    return (
                      <RaceLane
                        key={player.id}
                        name={player.id === selfId ? `${player.name} (you)` : player.spectating ? `${player.name} · watching` : player.name}
                        solid={tone.solid}
                        tint={tone.tint}
                        percent={percentOf(player.cursorIndex)}
                        wpm={player.wpm}
                        accuracy={player.accuracy}
                        done={player.completed}
                        place={player.completed && mode === "snippet" && racers.length > 2 ? place : undefined}
                      />
                    );
                  })}
                </div>

                {myFinished && !raceClosed && (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold animate-fade-in">
                    <Loader2 className="size-4 animate-spin text-amber-600 dark:text-amber-400" />
                    {mode === "timed" ? "Time! Collecting everyone's results…" : `You finished ${ordinal(myPlace)}. Waiting for the others${windowLeft !== null ? ` · closes in ${windowLeft}s` : "…"}`}
                  </div>
                )}

                {raceClosed && (
                  <section className={cn("rounded-2xl border p-5 text-center animate-scale-in sm:p-6", outcome === "victory" ? "border-amber-500/50 bg-amber-500/10" : "bg-card/80")}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Race over</p>
                    <h2 className={cn("mt-1 text-4xl font-black tracking-tight", outcome === "victory" && "text-amber-600 dark:text-amber-400")}>
                      {!iRaced ? `${standings[0]?.name ?? "Nobody"} wins` : outcome === "victory" ? "You win" : outcome === "draw" ? "Draw" : soloRival ? `${soloRival.name} wins` : `${ordinal(myPlace)} place`}
                    </h2>
                    {iRaced && <p className="mt-1 text-sm text-muted-foreground">{marginText}</p>}

                    <ol className="mx-auto mt-5 max-w-xl divide-y divide-border/50 overflow-hidden rounded-xl border bg-background/50 text-left">
                      {standings.map((player, index) => {
                        const tone = seatTone(players, player.id, selfId);
                        const time = player.completed && player.finishTimeMs && mode === "snippet" ? `${(player.finishTimeMs / 1000).toFixed(1)}s` : mode === "snippet" ? `${Math.round(percentOf(player.cursorIndex))}%` : "";
                        return (
                          <li key={player.id} className={cn("grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-3 py-2.5", player.id === selfId && "bg-amber-500/10")}>
                            <span className={cn("text-center font-mono text-sm font-black", index === 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                              {index === 0 ? <Trophy className="mx-auto size-4" /> : index + 1}
                            </span>
                            <span className="flex min-w-0 items-center gap-2">
                              <Avatar name={player.name} solid={tone.solid} size="sm" />
                              <span className="truncate text-sm font-bold">{player.name}{player.id === selfId && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
                            </span>
                            <span className="text-right font-mono text-xs tabular-nums">
                              <span className="text-sm font-black">{player.wpm.toFixed(1)}</span> <span className="text-muted-foreground">wpm</span>
                              <span className="block text-[10px] text-muted-foreground sm:ml-1 sm:inline sm:text-xs">{player.accuracy}%{time && ` · ${time}`}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ol>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRematchSent(true);
                          requestRematch();
                        }}
                        disabled={rematchSent || players.length < MIN_PLAYERS}
                        className="flex h-11 items-center gap-2 rounded-xl bg-foreground px-6 text-sm font-black text-background transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {rematchSent ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                        {rematchSent ? "Setting up rematch…" : "Rematch"}
                      </button>
                      <button type="button" onClick={handleLeave} className="flex h-11 items-center gap-2 rounded-xl border border-border/70 px-5 text-sm font-semibold transition-colors hover:bg-muted cursor-pointer">
                        <LogOut className="size-4" /> Leave
                      </button>
                    </div>
                  </section>
                )}

                <div ref={editorContainerRef} tabIndex={0} onKeyDown={handleEditorKeyDown} onClick={focusEditor} className="relative outline-none">
                  <CodeDisplay
                    chars={charStates}
                    filename={snippet.filename || "duel_challenge.ts"}
                    language={snippet.language}
                    source={snippet.source}
                    input={typedText}
                    onClick={focusEditor}
                    isRunning={duelState === "racing" && !myFinished}
                    ghostCharIndex={soloRival?.cursorIndex ?? null}
                    ghostWpm={soloRival?.wpm ?? null}
                  />

                  <textarea
                    ref={hiddenInputRef}
                    value=""
                    onChange={() => {}}
                    onKeyDown={handleEditorKeyDown}
                    className="pointer-events-none absolute inset-0 resize-none opacity-0"
                    aria-label="Code typing editor"
                  />

                  {duelState === "countdown" && (
                    <div className="duel-countdown absolute inset-0 z-20 grid place-items-center rounded-2xl" aria-live="assertive">
                      <div className="text-center">
                        <span key={countdownSeconds} className="duel-count block font-mono text-8xl font-black text-white sm:text-9xl">
                          {countdownSeconds > 0 ? countdownSeconds : "GO"}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-white/80">
                          Read the first line. {racers.length > 2 ? `${racers.length} racers` : soloRival ? `vs ${soloRival.name}` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {duelState === "racing" && !myFinished && iRaced && (
                  <p className="text-center text-xs text-muted-foreground">
                    Type straight into the editor. <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> for new lines,{" "}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd> for indentation.
                  </p>
                )}
                {!iRaced && duelState !== "finished" && (
                  <p className="text-center text-xs text-muted-foreground">You joined mid-race. You are in the next one once the host starts a rematch.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
