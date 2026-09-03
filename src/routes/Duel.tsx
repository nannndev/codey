import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Code2,
  Sparkles,
  Sliders,
  Timer,
  Focus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CodeDisplay } from "@/components/CodeDisplay";
import { useAuth } from "@/components/AuthProvider";
import { usePeerDuel, snippetForConfig, type DuelConfig } from "@/hooks/usePeerDuel";
import { getLanguages, maxSnippetCharsForLanguage } from "@/data";
import { SNIPPET_LENGTH_SPEC } from "@/utils/ranking";
import { computeCharStates, computeWpm } from "@/utils";
import { useKeyboardSound } from "@/hooks/useKeyboardSound";
import { usePreferences } from "@/components/PreferencesProvider";
import { getDuelHistory, saveDuelRecord, getDuelStats, type DuelRecord } from "@/utils/duel-history";
import type { TestMode, SnippetLength, TimedDuration } from "@/types";

export default function Duel() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const playerName = user?.name || "Typist";

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

  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [myWpm, setMyWpm] = useState(0);
  const [myAcc, setMyAcc] = useState(100);
  const [myFinished, setMyFinished] = useState(false);
  const [myFinishTimeMs, setMyFinishTimeMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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

  // Compute character states for the authentic VS Code editor CodeDisplay
  const charStates = useMemo(() => {
    return computeCharStates(snippet.code, typedText);
  }, [snippet.code, typedText]);

  // Focus typing editor when race starts
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
    if (duelState === "lobby" || duelState === "idle") {
      setMyFinished(false);
      setMyFinishTimeMs(null);
      setSecondsLeft(null);
      setTypedText("");
    }
  }, [duelState, focusEditor, mode, durationSeconds]);

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
  const isIWinner = useMemo(() => {
    if (!raceOver) return false;
    if (mode === "timed") return myWpm >= opponent.wpm;
    if (myFinished && opponent.completed && myFinishTimeMs !== null && opponent.finishTimeMs !== undefined) {
      return myFinishTimeMs < opponent.finishTimeMs;
    }
    return myFinished;
  }, [raceOver, mode, myFinished, opponent.completed, myFinishTimeMs, opponent.finishTimeMs, myWpm, opponent.wpm]);

  // Automatically save match result when completed
  useEffect(() => {
    if (raceOver && !savedRecordRef.current && (myWpm > 0 || opponent.wpm > 0)) {
      savedRecordRef.current = true;
      const outcome = isIWinner ? "victory" : "defeat";
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
      const updated = saveDuelRecord(record);
      setHistory(updated);
      setStats(getDuelStats());
    }
  }, [raceOver, isIWinner, myWpm, opponent.wpm, myAcc, opponent.accuracy, snippet.language, opponent.name]);

  // Comprehensive Multiline KeyDown Handler (Handles Enter \n, Tab, Backspace, Space & Characters)
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

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // The static pool is small, so some lengths cannot be built for some languages.
  // Marking them keeps the lobby honest instead of silently serving a short run.
  const unavailableLengths = useMemo(() => {
    const budget = maxSnippetCharsForLanguage(selectedLanguage === "All" ? undefined : selectedLanguage);
    return new Set(
      (["short", "medium", "long"] as SnippetLength[]).filter(
        (len) => budget < SNIPPET_LENGTH_SPEC[len].minChars
      )
    );
  }, [selectedLanguage]);

  // Handle Mode & Language change by Host
  function handleHostChangeMode(newMode: TestMode) {
    const next = { ...duelConfig, mode: newMode };
    updateLobbyConfig(next, snippetForConfig(next));
  }

  function handleHostChangeLanguage(lang: string) {
    const next = { ...duelConfig, selectedLanguage: lang };
    updateLobbyConfig(next, snippetForConfig(next));
  }

  function handleHostChangeSnippetLength(len: SnippetLength) {
    const next = { ...duelConfig, snippetLength: len };
    updateLobbyConfig(next, snippetForConfig(next));
  }

  function handleHostChangeDuration(dur: TimedDuration) {
    const next = { ...duelConfig, durationSeconds: dur };
    updateLobbyConfig(next, snippetForConfig(next));
  }

  const targetCode = snippet.code;
  const myProgressPercent = Math.min(100, Math.round((typedText.length / targetCode.length) * 100));
  const oppProgressPercent = Math.min(100, Math.round((opponent.cursorIndex / targetCode.length) * 100));

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        
        {/* Navigation Breadcrumb */}
        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to typing
        </Link>

        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-amber-500 font-bold">
              <Swords className="size-3.5 text-amber-500" /> Esports Live Arena
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-foreground font-sans flex items-center gap-3">
              1v1 Real-Time Code Race
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400">
                P2P WEBRTC
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground font-sans max-w-xl leading-relaxed">
              Test your real-time coding speed against friends or developers. Host a match or join an active room code!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-xl glass-card p-1 text-xs font-bold shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab("arena")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs transition-colors cursor-pointer ${activeTab === "arena" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:bg-muted font-medium"}`}
              >
                <Swords className="size-3.5" /> Race Arena
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs transition-colors cursor-pointer ${activeTab === "history" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:bg-muted font-medium"}`}
              >
                <History className="size-3.5" /> History ({stats.total})
              </button>
            </div>

            {duelState !== "idle" && (
              <Button type="button" variant="outline" size="sm" onClick={leaveDuel} className="text-red-400 border-red-500/30 hover:bg-red-500/10 h-8 text-xs font-medium">
                Leave Room
              </Button>
            )}
          </div>
        </header>

        {/* ──── TAB 2: MATCH HISTORY & STATS ──── */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-fade-in">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl glass-card p-4 shadow-xs">
                <Trophy className="mb-2 size-4.5 text-amber-400" />
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{stats.wins} <span className="text-xs font-medium text-muted-foreground">/ {stats.total} W</span></div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Win Rate {stats.winRate}%</div>
              </div>
              <div className="rounded-2xl glass-card p-4 shadow-xs">
                <Flame className="mb-2 size-4.5 text-amber-500 animate-pulse" />
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{stats.currentStreak} 🔥</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Current Win Streak</div>
              </div>
              <div className="rounded-2xl glass-card p-4 shadow-xs">
                <Zap className="mb-2 size-4.5 text-sky-400" />
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{stats.bestWpm.toFixed(1)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Duel WPM Record</div>
              </div>
              <div className="rounded-2xl glass-card p-4 shadow-xs">
                <Swords className="mb-2 size-4.5 text-purple-400" />
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{stats.losses}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Losses</div>
              </div>
            </div>

            {/* Past Matches List */}
            <div className="rounded-2xl glass-card overflow-hidden shadow-sm">
              <div className="border-b border-border/40 bg-muted/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                📜 1v1 Duel Match Logs
              </div>
              {history.length === 0 ? (
                <div className="grid h-40 place-items-center text-xs text-muted-foreground">
                  No duel history yet. Create or join a duel room to test your skills!
                </div>
              ) : (
                <div className="divide-y divide-border/30 max-h-[420px] overflow-y-auto">
                  {history.map((record) => {
                    const isWin = record.outcome === "victory";
                    const wpmDiff = (record.myWpm - record.oppWpm).toFixed(1);
                    return (
                      <div key={record.id} className="grid grid-cols-[100px_1fr_120px_80px] items-center gap-3 px-5 py-3 text-xs hover:bg-muted/30 transition-colors">
                        <div className={`flex items-center gap-1.5 font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                          {isWin ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                          <span className="uppercase font-black text-[11px]">{isWin ? "WIN" : "LOSS"}</span>
                        </div>

                        <div>
                          <p className="font-bold text-foreground text-xs">vs {record.opponentName}</p>
                          <p className="text-[10px] text-muted-foreground">{record.language} · {new Date(record.timestamp).toLocaleDateString()}</p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-bold text-foreground tabular-nums text-xs">{record.myWpm.toFixed(1)} WPM</p>
                          <p className="text-[10px] text-muted-foreground">vs {record.oppWpm.toFixed(1)} WPM</p>
                        </div>

                        <div className={`text-right font-mono font-bold text-xs ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                          {isWin ? `+${wpmDiff}` : wpmDiff}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── TAB 1: RACE ARENA ──── */}
        {activeTab === "arena" && (
          <div className="space-y-5">
            {/* ──── SCREEN 1: IDLE (SELECT MODE & LANGUAGE BEFORE DUEL) ──── */}
            {duelState === "idle" && (
              <div className="space-y-4">
                {/* Pre-Race Mode & Language Selector Bar */}
                <div className="glass-card rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sliders className="size-4 text-amber-500" />
                      <h4 className="font-bold text-xs tracking-tight text-foreground font-sans">Arena Match Configuration</h4>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-sans">Host settings apply to both duelists</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Mode Selector */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Match Mode</label>
                      <div className="flex rounded-xl border border-border/60 bg-card/60 p-0.5 h-9">
                        <button
                          type="button"
                          onClick={() => handleHostChangeMode("snippet")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs transition-all cursor-pointer ${mode === "snippet" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:text-foreground font-medium"}`}
                        >
                          <Zap className="size-3.5" /> Snippet
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHostChangeMode("timed")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs transition-all cursor-pointer ${mode === "timed" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:text-foreground font-medium"}`}
                        >
                          <Timer className="size-3.5" /> Timer
                        </button>
                      </div>
                    </div>

                    {/* Language Selector */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Programming Language</label>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => handleHostChangeLanguage(e.target.value)}
                        className="w-full h-9 rounded-xl border border-border/60 bg-card/60 px-3 text-xs font-mono font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {languages.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </div>

                    {/* Format Sub-Option (Length or Timed Seconds) */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        {mode === "snippet" ? "Snippet Length" : "Duration"}
                      </label>
                      <div className="flex gap-1.5 h-9 items-center">
                        {mode === "snippet" ? (
                          (["short", "medium", "long"] as SnippetLength[]).map((len) => (
                            <button
                              key={len}
                              type="button"
                              onClick={() => handleHostChangeSnippetLength(len)}
                              className={`flex-1 h-9 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${snippetLength === len ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold shadow-xs" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}
                            >
                              {len}
                            </button>
                          ))
                        ) : (
                          ([15, 30, 60] as TimedDuration[]).map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => handleHostChangeDuration(dur)}
                              className={`flex-1 h-9 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${durationSeconds === dur ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold shadow-xs" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}
                            >
                              {dur}s
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create or Join Room Action Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Create Card */}
                  <div className="glass-card rounded-2xl p-6 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/60 to-card/60 flex flex-col justify-between space-y-5 shadow-sm hover:border-amber-500/50 transition-all duration-300">
                    <div className="flex items-start gap-3.5">
                      <div className="size-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-xs">
                        <Swords className="size-5.5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-foreground font-sans">Create Duel Room</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-sans">
                          Host a new live match with your selected rules and share the room code with an opponent.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void createRoom(snippetForConfig(duelConfig), duelConfig)}
                      className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Play className="size-4 fill-current" /> Create New Room
                    </Button>
                  </div>

                  {/* Join Card */}
                  <div className="glass-card rounded-2xl p-6 border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-card/60 to-card/60 flex flex-col justify-between space-y-5 shadow-sm hover:border-sky-500/50 transition-all duration-300">
                    <div className="flex items-start gap-3.5">
                      <div className="size-11 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center shrink-0 shadow-xs">
                        <Users className="size-5.5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-foreground font-sans">Join Friend's Room</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-sans">
                          Have a room code from an opponent? Enter the 6-character room code below to race.
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full gap-2.5">
                      <input
                        type="text"
                        placeholder="EG: CODEY-X892"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" && inputCode.trim()) {
                            void joinRoom(inputCode);
                          }
                        }}
                        className="h-11 flex-1 rounded-xl border border-border/70 bg-background/80 px-3.5 text-center text-sm font-mono font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <Button
                        type="button"
                        disabled={!inputCode.trim()}
                        onClick={() => void joinRoom(inputCode)}
                        className="h-11 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-black text-sm transition-all shadow-md disabled:opacity-40 cursor-pointer"
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ──── SCREEN 2: LOBBY ──── */}
            {duelState === "lobby" && (
              <div className="space-y-4 glass-card rounded-2xl p-4 sm:p-5 shadow-sm">
                {/* Room Link Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">📋 Duel Room Code</span>
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-foreground">{roomCode}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="h-8 px-3 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/20 rounded-lg cursor-pointer"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </Button>
                </div>

                {/* Agreed match settings — rendered identically for host and guest */}
                <div className="rounded-xl border border-border/50 bg-card/40 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <span className="text-xs uppercase tracking-wider text-foreground font-bold flex items-center gap-1.5 font-sans">
                      <Code2 className="size-3.5 text-amber-400" /> Duel Match Rules {isHost ? "(Host)" : "(Set by Host)"}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {connectionStatus === "connected" ? "🟢 Both players connected" : "⏳ Waiting for opponent..."}
                    </span>
                  </div>

                  {/* The three facts both players must agree on before racing */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/50 bg-background/50 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mode</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-foreground">
                        {mode === "timed" ? <Timer className="size-3 text-amber-400" /> : <Zap className="size-3 text-amber-400" />}
                        {mode === "timed" ? "Timer" : "Snippet"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Language</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-foreground">
                        <Code2 className="size-3 text-sky-400" />
                        {snippet.language}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {mode === "timed" ? "Duration" : "Snippet Length"}
                      </div>
                      <div className="mt-0.5 text-xs font-bold capitalize text-foreground">
                        {mode === "timed" ? `${durationSeconds}s` : snippetLength}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Code Length</div>
                      <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-foreground">{snippet.code.length} chars</div>
                    </div>
                  </div>

                  {isHost ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2.5">
                      <div className="flex rounded-lg border border-border/60 bg-card/60 p-0.5 h-8">
                        <button
                          type="button"
                          onClick={() => handleHostChangeMode("snippet")}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${mode === "snippet" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Zap className="size-3" /> Snippet
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHostChangeMode("timed")}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${mode === "timed" ? "bg-foreground text-background shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Timer className="size-3" /> Timed
                        </button>
                      </div>

                      <select
                        value={selectedLanguage}
                        onChange={(e) => handleHostChangeLanguage(e.target.value)}
                        className="h-8 rounded-lg border border-border/60 bg-card/60 px-2.5 text-xs font-mono font-semibold text-foreground cursor-pointer"
                      >
                        {languages.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>

                      <div className="flex gap-1 h-8 items-center">
                        {mode === "snippet"
                          ? (["short", "medium", "long"] as SnippetLength[]).map((len) => (
                              <button
                                key={len}
                                type="button"
                                onClick={() => handleHostChangeSnippetLength(len)}
                                title={unavailableLengths.has(len) ? `Not enough ${selectedLanguage} snippets for a full ${len} run` : undefined}
                                className={`h-8 rounded-lg border px-2 text-xs font-semibold capitalize transition-all cursor-pointer ${snippetLength === len ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold shadow-xs" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}
                              >
                                {len}{unavailableLengths.has(len) ? " *" : ""}
                              </button>
                            ))
                          : ([15, 30, 60] as TimedDuration[]).map((dur) => (
                              <button
                                key={dur}
                                type="button"
                                onClick={() => handleHostChangeDuration(dur)}
                                className={`h-8 rounded-lg border px-2 text-xs font-semibold transition-all cursor-pointer ${durationSeconds === dur ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold shadow-xs" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}
                              >
                                {dur}s
                              </button>
                            ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateLobbyConfig(duelConfig, snippetForConfig(duelConfig))}
                        className="h-8 gap-1 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        <Sparkles className="size-3 text-amber-400" /> Randomize Snippet
                      </Button>
                    </div>
                  ) : (
                    <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
                      {opponent.name} is the Host and manages match settings. You will both type the exact same code.
                    </p>
                  )}

                  {isHost && mode === "snippet" && unavailableLengths.has(snippetLength) && (
                    <p className="text-[10px] text-amber-400/80">
                      * Limited {selectedLanguage} snippets available — you will race with {snippet.code.length} characters.
                    </p>
                  )}
                </div>

                {/* Matchup Players Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className={`rounded-xl border p-4 text-center space-y-2.5 transition-all ${isReady ? "border-emerald-500/50 bg-emerald-500/10 shadow-xs" : "border-border/60 bg-card/40"}`}>
                    <div className="grid size-12 place-items-center mx-auto rounded-xl bg-amber-500 text-zinc-950 font-black text-lg shadow-xs">
                      {playerName.slice(0, 1).toUpperCase()}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground">{playerName} (You)</h4>
                    <Button
                      type="button"
                      variant={isReady ? "default" : "outline"}
                      size="sm"
                      onClick={toggleReady}
                      className="w-full h-8 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      {isReady ? "READY TO RACE ✓" : "Click to Ready"}
                    </Button>
                  </div>

                  <div className={`rounded-xl border p-4 text-center space-y-2.5 transition-all ${opponentReady ? "border-emerald-500/50 bg-emerald-500/10 shadow-xs" : "border-border/60 bg-card/40"}`}>
                    <div className="grid size-12 place-items-center mx-auto rounded-xl bg-sky-500 text-zinc-950 font-black text-lg shadow-xs">
                      {opponent.name.slice(0, 1).toUpperCase()}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground">{opponent.name}</h4>
                    <div className={`text-xs font-semibold py-1.5 rounded-lg border ${opponentReady ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/15 font-bold" : "border-border/60 text-muted-foreground bg-card/40"}`}>
                      {connectionStatus === "connected" ? (opponentReady ? "READY TO RACE ✓" : "Waiting for opponent...") : "Waiting for opponent to join..."}
                    </div>
                  </div>
                </div>

                {/* Start Race Button (Host only) */}
                {isHost && (
                  <Button
                    type="button"
                    disabled={!isReady || !opponentReady}
                    onClick={startMatch}
                    className="w-full h-10 font-black bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play className="size-4 fill-current" /> START DUEL NOW!
                  </Button>
                )}
              </div>
            )}

            {/* ──── SCREEN 3: COUNTDOWN ──── */}
            {duelState === "countdown" && (
              <div className="grid h-80 place-items-center text-center space-y-4 animate-fade-in rounded-3xl border bg-card/80 p-8 shadow-xl">
                <span className="text-8xl font-black text-amber-400 animate-ping">{countdownSeconds}</span>
                <div className="space-y-2">
                  <p className="text-base font-bold text-muted-foreground uppercase tracking-widest">GET READY TO TYPE!</p>
                  <p className="text-sm font-bold text-foreground">
                    {snippet.language} · {mode === "timed" ? `Timed ${durationSeconds}s` : `${snippetLength} snippet`} · vs {opponent.name}
                  </p>
                </div>
              </div>
            )}

            {/* ──── SCREEN 4: RACING & RESULTS (VS CODE CODE DISPLAY LAYOUT) ──── */}
            {(duelState === "racing" || duelState === "finished") && (
              <div className="space-y-6">
                {/* Live Progress Track */}
                <div className="space-y-4 rounded-3xl border bg-card/90 p-6 shadow-xl">
                  {/* Match settings stay visible mid-race so both players know what they are running */}
                  <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-[11px] font-bold uppercase tracking-wider">
                    <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-400 flex items-center gap-1.5">
                      {mode === "timed" ? <Timer className="size-3.5" /> : <Zap className="size-3.5" />}
                      {mode === "timed" ? `Timed ${durationSeconds}s` : `${snippetLength} Snippet`}
                    </span>
                    <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-400 flex items-center gap-1.5">
                      <Code2 className="size-3.5" /> {snippet.language}
                    </span>
                    <span className="rounded-lg border bg-muted/40 px-2 py-1 text-muted-foreground font-mono tabular-nums">
                      {snippet.code.length} chars
                    </span>
                  </div>

                  {mode === "timed" && secondsLeft !== null && (
                    <div className="flex items-center justify-center gap-2 pb-2">
                      <Timer className={`size-5 ${secondsLeft <= 5 ? "text-red-400" : "text-amber-400"}`} />
                      <span className={`font-mono text-3xl font-black tabular-nums ${secondsLeft <= 5 ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
                        {secondsLeft}s
                      </span>
                    </div>
                  )}

                  {/* My Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-amber-400 flex items-center gap-1.5">🏎️ {playerName} (You)</span>
                      <span className="font-mono tabular-nums text-sm">{myWpm.toFixed(1)} WPM · {myAcc}% ACC</span>
                    </div>
                    <div className="h-4 rounded-full bg-muted overflow-hidden p-0.5">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-150 shadow-md" style={{ width: `${myProgressPercent}%` }} />
                    </div>
                  </div>

                  {/* Opponent Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-sky-400 flex items-center gap-1.5">🏎️ {opponent.name}</span>
                      <span className="font-mono tabular-nums text-sm">{opponent.wpm.toFixed(1)} WPM · {opponent.accuracy}% ACC</span>
                    </div>
                    <div className="h-4 rounded-full bg-muted overflow-hidden p-0.5">
                      <div className="h-full bg-sky-500 rounded-full transition-all duration-150 shadow-md" style={{ width: `${oppProgressPercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Authentic VS Code Editor CodeDisplay Window */}
                <div
                  ref={editorContainerRef}
                  tabIndex={0}
                  onKeyDown={handleEditorKeyDown}
                  onClick={focusEditor}
                  className="relative outline-none cursor-pointer group"
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

                  {/* Hidden Textarea to Capture Typing Events Seamlessly */}
                  <textarea
                    ref={hiddenInputRef}
                    value=""
                    onChange={() => {}}
                    onKeyDown={handleEditorKeyDown}
                    className="absolute inset-0 opacity-0 pointer-events-none resize-none"
                    aria-label="Code typing editor"
                  />

                  {/* Focus Helper Bar */}
                  {duelState === "racing" && !myFinished && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Focus className="size-4 text-amber-400 animate-pulse" />
                        Editor Focused — Type directly into the code window. Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Enter ↵</kbd> for newline and <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Tab ⇥</kbd> for indentation.
                      </span>
                    </div>
                  )}
                </div>

                {/* Result Winner Banner */}
                {raceOver && (
                  <div className={`rounded-3xl border p-8 text-center space-y-4 animate-scale-in shadow-2xl ${isIWinner ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-red-500/60 bg-red-500/15 text-red-400"}`}>
                    <h3 className="text-4xl font-black">{isIWinner ? "🏆 VICTORY!" : "💀 DEFEAT!"}</h3>
                    <p className="text-base font-bold text-foreground">
                      Your Speed: <strong className="text-amber-400">{myWpm.toFixed(1)} WPM · {myAcc}% ACC</strong> vs {opponent.name}: <strong className="text-sky-400">{opponent.wpm.toFixed(1)} WPM · {opponent.accuracy}% ACC</strong>
                    </p>
                    <Button type="button" size="lg" onClick={() => requestRematch()} className="font-bold bg-foreground text-background text-base py-6 px-8 shadow-xl">
                      <RotateCcw data-icon="inline-start" /> Rematch
                    </Button>
                  </div>
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
