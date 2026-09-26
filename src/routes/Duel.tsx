import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Swords,
  Users,
  Copy,
  Check,
  Play,
  RotateCcw,
  History,
  Trophy,
  Flame,
  Zap,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Code2,
  Shuffle,
  Timer,
  Link2,
  LogOut,
  Loader2,
  Flag,
  AlertTriangle,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CodeDisplay } from "@/components/CodeDisplay";
import { useAuth } from "@/components/AuthProvider";
import { usePeerDuel, snippetForConfig, ROOM_PREFIX, type DuelConfig } from "@/hooks/usePeerDuel";
import { getLanguages, maxSnippetCharsForLanguage } from "@/data";
import { SNIPPET_LENGTH_SPEC } from "@/utils/ranking";
import { computeCharStates, computeWpm } from "@/utils";
import { useKeyboardSound } from "@/hooks/useKeyboardSound";
import { usePreferences } from "@/components/PreferencesProvider";
import { getDuelHistory, saveDuelRecord, getDuelStats, type DuelRecord } from "@/utils/duel-history";
import { cn } from "@/lib/utils";
import type { TestMode, SnippetLength, TimedDuration } from "@/types";

type Outcome = DuelRecord["outcome"];

const LENGTHS: SnippetLength[] = ["short", "medium", "long"];
const DURATIONS: TimedDuration[] = [15, 30, 60];

const segment = (active: boolean) =>
  cn(
    "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold capitalize transition-colors cursor-pointer",
    active ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
  );

/** Mode, language and length/duration: the rules both players race under. */
function MatchRules({ config, onChange, onShuffle, languages, unavailableLengths }: {
  config: DuelConfig;
  onChange: (next: DuelConfig) => void;
  onShuffle?: () => void;
  languages: string[];
  unavailableLengths: Set<SnippetLength>;
}) {
  const { mode, snippetLength, durationSeconds, selectedLanguage } = config;
  return (
    <div className="grid gap-2.5 sm:grid-cols-[auto_1fr_auto]">
      <div className="flex rounded-xl border border-border/60 bg-background/60 p-0.5">
        {(["snippet", "timed"] as TestMode[]).map((value) => (
          <button key={value} type="button" onClick={() => onChange({ ...config, mode: value })} className={segment(mode === value)}>
            {value === "timed" ? <Timer className="size-3.5" /> : <Zap className="size-3.5" />}
            {value === "timed" ? "Timed" : "Snippet"}
          </button>
        ))}
      </div>
      <select
        value={selectedLanguage}
        onChange={(event) => onChange({ ...config, selectedLanguage: event.target.value })}
        aria-label="Language"
        className="h-9 min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 font-mono text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
      >
        {languages.map((language) => (
          <option key={language}>{language}</option>
        ))}
      </select>
      <div className="flex gap-1">
        <div className="flex flex-1 rounded-xl border border-border/60 bg-background/60 p-0.5">
          {mode === "snippet"
            ? LENGTHS.map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => onChange({ ...config, snippetLength: len })}
                  title={unavailableLengths.has(len) ? `Not enough ${selectedLanguage} snippets for a full ${len} run` : undefined}
                  className={segment(snippetLength === len)}
                >
                  {len}
                  {unavailableLengths.has(len) && <span className="text-amber-500">*</span>}
                </button>
              ))
            : DURATIONS.map((dur) => (
                <button key={dur} type="button" onClick={() => onChange({ ...config, durationSeconds: dur })} className={segment(durationSeconds === dur)}>
                  {dur}s
                </button>
              ))}
        </div>
        {onShuffle && (
          <button
            type="button"
            onClick={onShuffle}
            title="Pick another snippet"
            aria-label="Pick another snippet"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <Shuffle className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, tone, size = "md" }: { name: string; tone: "you" | "them"; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black text-zinc-950",
        tone === "you" ? "bg-amber-500" : "bg-sky-400",
        size === "md" ? "size-14 text-xl" : "size-7 text-xs"
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function PlayerSlot({ name, tone, ready, empty, label, children }: {
  name: string;
  tone: "you" | "them";
  ready: boolean;
  empty?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  if (empty) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-4 text-center">
        <span className="grid size-14 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </span>
        <p className="text-sm font-semibold">Waiting for opponent</p>
        <p className="max-w-52 text-xs text-muted-foreground">Send them the invite link. They join straight into this room.</p>
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-colors",
        ready ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 bg-background/40"
      )}
    >
      <div className="relative">
        <Avatar name={name} tone={tone} />
        {ready && (
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-card">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div>
        <p className="max-w-40 truncate text-sm font-bold">{name}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
          ready ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
        )}
      >
        {ready ? "Ready" : "Not ready"}
      </span>
      {children}
    </div>
  );
}

function RaceLane({ name, tone, percent, wpm, accuracy, done }: {
  name: string;
  tone: "you" | "them";
  percent: number;
  wpm: number;
  accuracy: number;
  done: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,7.5rem)_1fr_auto]">
      <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
        <Avatar name={name} tone={tone} size="sm" />
        <span className="truncate text-xs font-bold">{name}</span>
      </div>
      <div className="duel-lane relative h-7 rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-200", tone === "you" ? "bg-amber-500/25" : "bg-sky-400/25")}
          style={{ width: `${percent}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 grid size-6 place-items-center rounded-full text-[10px] font-black text-zinc-950 shadow-md transition-[left] duration-200",
            tone === "you" ? "bg-amber-500" : "bg-sky-400"
          )}
          style={{ left: `calc(${percent}% - ${percent / 100} * 1.5rem)`, translate: "0 -50%" }}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : name.trim().charAt(0).toUpperCase()}
        </span>
        <Flag className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
      </div>
      <div className="text-right font-mono text-xs leading-tight tabular-nums sm:w-36">
        <span className="text-sm font-black">{wpm.toFixed(0)}</span> <span className="text-muted-foreground">wpm</span>
        <span className="block text-[10px] text-muted-foreground sm:ml-2 sm:inline sm:text-xs">{accuracy}% acc</span>
      </div>
    </div>
  );
}

function StatColumn({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-2xl font-black tabular-nums", highlight && "text-emerald-600 dark:text-emerald-400")}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

export default function Duel() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const playerName = user?.name || "Typist";
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"arena" | "history">("arena");
  const [history, setHistory] = useState<DuelRecord[]>([]);
  const [stats, setStats] = useState(getDuelStats());
  const savedRecordRef = useRef<boolean>(false);

  const initialDuelConfig = useMemo<DuelConfig>(() => ({
    mode: "snippet",
    snippetLength: "medium",
    durationSeconds: 30,
    selectedLanguage: "All",
  }), []);

  const playSound = useKeyboardSound(
    preferences.keyboardSound,
    preferences.keyboardSoundProfile,
    preferences.keyboardSoundVolume,
    preferences.keyboardSoundTuning
  );

  const {
    error,
    opponentLeft,
    clearNotice,
    duelState,
    isHost,
    roomCode,
    connectionStatus,
    snippet,
    duelConfig,
    updateLobbyConfig,
    isReady,
    opponentReady,
    countdownSeconds,
    opponent,
    createRoom,
    joinRoom,
    toggleReady,
    startMatch,
    sendProgress,
    finishRace,
    requestRematch,
    leaveDuel,
  } = usePeerDuel(playerName, initialDuelConfig);

  const { mode, snippetLength, durationSeconds, selectedLanguage } = duelConfig;

  const [inputCode, setInputCode] = useState(() => (searchParams.get("room") ?? "").toUpperCase().replace(ROOM_PREFIX, ""));
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [creating, setCreating] = useState(false);
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

  // The host starts the countdown once both players are ready; no extra click.
  useEffect(() => {
    if (!isHost || duelState !== "lobby" || !isReady || !opponentReady || connectionStatus !== "connected") return;
    const timer = setTimeout(startMatch, 900);
    return () => clearTimeout(timer);
  }, [isHost, duelState, isReady, opponentReady, connectionStatus, startMatch]);

  // Timed mode: tick the clock down and end the race when it hits zero.
  useEffect(() => {
    if (duelState !== "racing" || mode !== "timed" || myFinished || secondsLeft === null) return;

    if (secondsLeft <= 0) {
      const elapsedMs = startTime ? Math.max(1000, Date.now() - startTime) : durationSeconds * 1000;
      setMyFinished(true);
      setMyFinishTimeMs(elapsedMs);
      finishRace({ ...liveStatsRef.current, finishTimeMs: elapsedMs });
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [duelState, mode, myFinished, secondsLeft, startTime, durationSeconds, finishRace]);

  const raceOver = duelState === "finished" || myFinished || opponent.completed;

  // Snippet mode: first to the end wins. Timed mode: both stop at zero, so WPM decides.
  const outcome = useMemo<Outcome | null>(() => {
    if (!raceOver) return null;
    if (mode === "timed") {
      const mine = Math.round(myWpm * 10);
      const theirs = Math.round(opponent.wpm * 10);
      return mine === theirs ? "draw" : mine > theirs ? "victory" : "defeat";
    }
    if (myFinished && opponent.completed && myFinishTimeMs !== null && opponent.finishTimeMs !== undefined) {
      if (myFinishTimeMs === opponent.finishTimeMs) return "draw";
      return myFinishTimeMs < opponent.finishTimeMs ? "victory" : "defeat";
    }
    return myFinished ? "victory" : "defeat";
  }, [raceOver, mode, myFinished, opponent.completed, myFinishTimeMs, opponent.finishTimeMs, myWpm, opponent.wpm]);

  useEffect(() => {
    if (outcome && !savedRecordRef.current && (myWpm > 0 || opponent.wpm > 0)) {
      savedRecordRef.current = true;
      const record: DuelRecord = {
        id: `duel-${Date.now()}`,
        timestamp: Date.now(),
        opponentName: opponent.name,
        myWpm,
        oppWpm: opponent.wpm,
        myAccuracy: myAcc,
        oppAccuracy: opponent.accuracy,
        language: snippet.language,
        outcome,
      };
      setHistory(saveDuelRecord(record));
      setStats(getDuelStats());
    }
  }, [outcome, myWpm, opponent.wpm, myAcc, opponent.accuracy, snippet.language, opponent.name]);

  function handleEditorKeyDown(e: React.KeyboardEvent) {
    if (duelState !== "racing" || myFinished) return;

    if (
      e.key === "Tab" ||
      e.key === "Enter" ||
      e.key === "Backspace" ||
      (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
    ) {
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
      if (expectedChar === "\t") {
        nextInput = typedText + "\t";
      } else if (snippet.code.slice(currentPos, currentPos + 2) === "  ") {
        nextInput = typedText + "  ";
      } else {
        nextInput = typedText + " ";
      }
      playSound("Tab");
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    // Reaching the end of the snippet ends the race, typos included — matching the solo game.
    const isCompleted = nextInput.length >= snippet.code.length;

    setMyWpm(currentWpm);
    setMyAcc(currentAcc);

    if (isCompleted && !myFinished) {
      setMyFinished(true);
      setMyFinishTimeMs(elapsedMs);
      finishRace({
        cursorIndex: nextInput.length,
        wpm: currentWpm,
        accuracy: currentAcc,
        finishTimeMs: elapsedMs,
      });
      return;
    }

    sendProgress({
      cursorIndex: nextInput.length,
      wpm: currentWpm,
      accuracy: currentAcc,
      completed: false,
    });
  }

  const inviteLink = roomCode ? `${window.location.origin}/duel?room=${roomCode.replace(ROOM_PREFIX, "")}` : "";

  function copy(kind: "link" | "code") {
    void navigator.clipboard?.writeText(kind === "link" ? inviteLink : roomCode);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handleCreate() {
    setCreating(true);
    await createRoom(snippetForConfig(duelConfig), duelConfig);
    setCreating(false);
  }

  function handleJoin() {
    if (!inputCode.trim()) return;
    void joinRoom(inputCode);
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

  // Idle: rules are local. Lobby: the host's change is pushed to the guest with a fresh snippet.
  const changeRules = (next: DuelConfig) => updateLobbyConfig(next, snippetForConfig(next));

  const targetCode = snippet.code;
  const myProgressPercent = Math.min(100, (typedText.length / targetCode.length) * 100);
  const oppProgressPercent = Math.min(100, (opponent.cursorIndex / targetCode.length) * 100);
  const lead = typedText.length - opponent.cursorIndex;
  const joining = duelState === "idle" && connectionStatus === "connecting";
  const opponentHere = connectionStatus === "connected";
  const inMatch = duelState === "countdown" || duelState === "racing" || duelState === "finished";

  const rulesLabel = `${snippet.language} · ${mode === "timed" ? `${durationSeconds}s timed` : `${snippetLength} snippet`}`;

  const notice = error ?? (opponentLeft ? (isHost ? `${opponent.name} left the room. The invite link still works.` : "The host closed the room.") : null);

  const marginText = (() => {
    if (!outcome) return "";
    if (mode === "timed") {
      const diff = Math.abs(myWpm - opponent.wpm);
      return outcome === "draw" ? "Dead even on speed." : `${outcome === "victory" ? "Won" : "Lost"} by ${diff.toFixed(1)} WPM`;
    }
    if (myFinishTimeMs !== null && opponent.finishTimeMs !== undefined) {
      const diff = Math.abs(myFinishTimeMs - opponent.finishTimeMs) / 1000;
      return outcome === "draw" ? "Photo finish." : `${outcome === "victory" ? "Won" : "Lost"} by ${diff.toFixed(2)}s`;
    }
    return outcome === "victory"
      ? `First to the end. ${opponent.name} was at ${Math.round(oppProgressPercent)}%.`
      : `${opponent.name} finished first. You were at ${Math.round(myProgressPercent)}%.`;
  })();

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
              <Swords className="size-3.5" /> 1v1 · live
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Duel</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Race a friend on the same snippet in real time. Peer to peer, no account needed.
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
            <button type="button" onClick={clearNotice} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground cursor-pointer">
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
                <div className="grid h-40 place-items-center px-5 text-center text-sm text-muted-foreground">
                  No duels yet. Create a room and send the link to a friend.
                </div>
              ) : (
                <div className="max-h-[420px] divide-y divide-border/40 overflow-y-auto">
                  {history.map((record) => {
                    const tone = record.outcome === "victory" ? "text-emerald-600 dark:text-emerald-400" : record.outcome === "draw" ? "text-muted-foreground" : "text-rose-500";
                    const Icon = record.outcome === "victory" ? CheckCircle2 : record.outcome === "draw" ? MinusCircle : XCircle;
                    const diff = record.myWpm - record.oppWpm;
                    return (
                      <div key={record.id} className="grid grid-cols-[72px_1fr_auto_64px] items-center gap-3 px-5 py-3 text-xs transition-colors hover:bg-muted/30">
                        <span className={cn("flex items-center gap-1.5 text-[11px] font-black uppercase", tone)}>
                          <Icon className="size-4" /> {record.outcome === "victory" ? "Win" : record.outcome === "draw" ? "Draw" : "Loss"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">vs {record.opponentName}</p>
                          <p className="text-[10px] text-muted-foreground">{record.language} · {new Date(record.timestamp).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <p className="font-bold">{record.myWpm.toFixed(1)} wpm</p>
                          <p className="text-[10px] text-muted-foreground">vs {record.oppWpm.toFixed(1)}</p>
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
            {/* ──── IDLE: host or join ──── */}
            {duelState === "idle" && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-card/80 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Swords className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-extrabold">Host a duel</h2>
                        <p className="text-xs text-muted-foreground">Pick the rules, then share the invite link.</p>
                      </div>
                    </div>
                    <MatchRules config={duelConfig} onChange={changeRules} languages={languages} unavailableLengths={unavailableLengths} />
                    <button
                      type="button"
                      onClick={() => void handleCreate()}
                      disabled={creating}
                      className="mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-black text-zinc-950 shadow-sm transition-colors hover:bg-amber-400 disabled:opacity-70 cursor-pointer"
                    >
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                      {creating ? "Opening room…" : "Create room"}
                    </button>
                  </section>

                  <section className="flex flex-col gap-4 rounded-2xl border border-sky-500/30 bg-card/80 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <Users className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-extrabold">Join a duel</h2>
                        <p className="text-xs text-muted-foreground">Open your friend's invite link, or type the room code.</p>
                      </div>
                    </div>
                    <form
                      className="mt-auto flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleJoin();
                      }}
                    >
                      <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-background/80 font-mono text-sm font-bold focus-within:ring-2 focus-within:ring-sky-500/60">
                        <span className="select-none pl-3.5 text-muted-foreground">{ROOM_PREFIX}</span>
                        <input
                          type="text"
                          inputMode="text"
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
                  </section>
                </div>

                <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {["Create a room and pick the rules.", "Send the invite link to your opponent.", "Both press Ready. The race starts on its own."].map((step, index) => (
                    <li key={step} className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/50 px-3.5 py-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] font-bold text-foreground">{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ──── LOBBY ──── */}
            {duelState === "lobby" && (
              <div className="space-y-4 rounded-2xl border bg-card/80 p-4 animate-fade-in sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Room</p>
                    <p className="font-mono text-xl font-black tracking-widest sm:text-2xl">{roomCode}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isHost && (
                      <>
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
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleLeave}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-border/70 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                    >
                      <LogOut className="size-3.5" /> Leave
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                  <PlayerSlot name={playerName} tone="you" ready={isReady} label={isHost ? "You · host" : "You"} />
                  <span className="duel-vs select-none text-2xl font-black italic text-muted-foreground/70 sm:text-4xl">VS</span>
                  <PlayerSlot
                    name={opponent.name}
                    tone="them"
                    ready={opponentReady}
                    empty={!opponentHere}
                    label={isHost ? "Opponent" : "Host"}
                  >
                    {!opponentHere && isHost && (
                      <button type="button" onClick={() => copy("link")} className="mt-1 flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-[11px] font-semibold hover:bg-muted cursor-pointer">
                        {copied === "link" ? <Check className="size-3" /> : <Link2 className="size-3" />}
                        {copied === "link" ? "Copied" : "Copy link"}
                      </button>
                    )}
                  </PlayerSlot>
                </div>

                <div className="space-y-2.5 rounded-xl border border-border/50 bg-background/40 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold">
                      <Code2 className="size-3.5 text-amber-500" /> Rules
                      <span className="font-normal text-muted-foreground">{isHost ? "· you set these" : `· set by ${opponent.name}`}</span>
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {rulesLabel} · {snippet.code.length} chars
                    </p>
                  </div>
                  {isHost ? (
                    <MatchRules
                      config={duelConfig}
                      onChange={changeRules}
                      onShuffle={() => updateLobbyConfig(duelConfig, snippetForConfig(duelConfig))}
                      languages={languages}
                      unavailableLengths={unavailableLengths}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">You will both type the exact same code. Changing rules un-readies you so nothing starts by surprise.</p>
                  )}
                  {isHost && mode === "snippet" && unavailableLengths.has(snippetLength) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      * Limited {selectedLanguage} snippets. This race is {snippet.code.length} characters.
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleReady}
                    disabled={!opponentHere}
                    className={cn(
                      "flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                      isReady ? "border border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    )}
                  >
                    {isReady ? <Check className="size-4" strokeWidth={3} /> : <Play className="size-4 fill-current" />}
                    {isReady ? "Ready. Click to cancel" : "I'm ready"}
                  </button>
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {!opponentHere
                      ? "Waiting for your opponent to join."
                      : isReady && opponentReady
                        ? "Both ready. Starting…"
                        : isReady
                          ? `Waiting for ${opponent.name} to ready up.`
                          : opponentReady
                            ? `${opponent.name} is ready. Your move.`
                            : "The race starts as soon as you are both ready."}
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
                      {duelState === "racing" && !raceOver && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                            lead > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : lead < 0 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {mode === "timed"
                            ? myWpm === opponent.wpm ? "Even pace" : myWpm > opponent.wpm ? `Ahead by ${(myWpm - opponent.wpm).toFixed(0)} wpm` : `Behind by ${(opponent.wpm - myWpm).toFixed(0)} wpm`
                            : lead === 0 ? "Neck and neck" : lead > 0 ? `Leading by ${lead} chars` : `Behind by ${-lead} chars`}
                        </span>
                      )}
                      {mode === "timed" && (
                        <span className={cn("flex items-center gap-1 font-mono text-lg font-black tabular-nums", secondsLeft !== null && secondsLeft <= 5 ? "text-rose-500" : "text-foreground")}>
                          <Timer className="size-4" /> {secondsLeft ?? durationSeconds}s
                        </span>
                      )}
                    </div>
                  </div>
                  <RaceLane name={`${playerName} (you)`} tone="you" percent={myProgressPercent} wpm={myWpm} accuracy={myAcc} done={myFinished} />
                  <RaceLane name={opponent.name} tone="them" percent={oppProgressPercent} wpm={opponent.wpm} accuracy={opponent.accuracy} done={opponent.completed} />
                </div>

                {raceOver && outcome && (
                  <section
                    className={cn(
                      "duel-result rounded-2xl border p-5 text-center animate-scale-in sm:p-6",
                      outcome === "victory" ? "border-amber-500/50 bg-amber-500/10" : outcome === "draw" ? "border-border bg-card/80" : "border-border bg-card/80"
                    )}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Race over</p>
                    <h2 className={cn("mt-1 text-4xl font-black tracking-tight", outcome === "victory" && "text-amber-600 dark:text-amber-400")}>
                      {outcome === "victory" ? "You win" : outcome === "draw" ? "Draw" : `${opponent.name} wins`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{marginText}</p>

                    <div className="mx-auto mt-5 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="space-y-2 rounded-xl border bg-background/50 p-3">
                        <p className="flex items-center justify-center gap-1.5 text-xs font-bold"><Avatar name={playerName} tone="you" size="sm" /> You</p>
                        <div className="grid grid-cols-2 gap-2">
                          <StatColumn label="WPM" value={myWpm.toFixed(1)} highlight={myWpm > opponent.wpm} />
                          <StatColumn label="Acc" value={`${myAcc}`} unit="%" highlight={myAcc > opponent.accuracy} />
                        </div>
                      </div>
                      <span className="text-sm font-black italic text-muted-foreground">VS</span>
                      <div className="space-y-2 rounded-xl border bg-background/50 p-3">
                        <p className="flex items-center justify-center gap-1.5 text-xs font-bold"><Avatar name={opponent.name} tone="them" size="sm" /> <span className="truncate">{opponent.name}</span></p>
                        <div className="grid grid-cols-2 gap-2">
                          <StatColumn label="WPM" value={opponent.wpm.toFixed(1)} highlight={opponent.wpm > myWpm} />
                          <StatColumn label="Acc" value={`${opponent.accuracy}`} unit="%" highlight={opponent.accuracy > myAcc} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRematchSent(true);
                          requestRematch();
                        }}
                        disabled={rematchSent || !opponentHere}
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

                <div
                  ref={editorContainerRef}
                  tabIndex={0}
                  onKeyDown={handleEditorKeyDown}
                  onClick={focusEditor}
                  className="relative outline-none"
                >
                  <CodeDisplay
                    chars={charStates}
                    filename={snippet.filename || "duel_challenge.ts"}
                    language={snippet.language}
                    source={snippet.source}
                    input={typedText}
                    onClick={focusEditor}
                    isRunning={duelState === "racing" && !myFinished}
                    ghostCharIndex={opponent.cursorIndex}
                    ghostWpm={opponent.wpm}
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
                        <p className="mt-2 text-sm font-semibold text-white/80">Read the first line. vs {opponent.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {duelState === "racing" && !myFinished && (
                  <p className="text-center text-xs text-muted-foreground">
                    Type straight into the editor. <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> for new lines,{" "}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd> for indentation.
                  </p>
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
