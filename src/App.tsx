import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { Coffee, CornerDownLeft, IndentIncrease, LoaderCircle, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Keyboard3D } from "@/components/Keyboard3D";
import { CodeDisplay } from "@/components/CodeDisplay";
import { StatsBar } from "@/components/StatsBar";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ModeSelector } from "@/components/ModeSelector";
import { CustomPractice } from "@/components/CustomPractice";
import { WeakKeyDrillModal } from "@/components/WeakKeyDrillModal";
import { DailyGoals } from "@/components/DailyGoals";
import { usePreferences } from "@/components/PreferencesProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { uploadRun } from "@/lib/cloud";
import { useGame, useKeyboardSound, useGhostRunner, useRankedGame, useDailyGame } from "@/hooks";
import { DailyChallengeCard, DailyModeBanner, DailyResultBanner } from "@/components/daily/DailyWidgets";
import { useSearchParams } from "react-router-dom";
import { buildDrillSnippet } from "@/utils/drill";
import { useSnippets } from "@/hooks/useSnippets";
import { getLanguages } from "@/data";
import {
  computeCharStates,
  computeWpm,
  computeRawWpm,
  computeConsistency,
  computePerLineStats,
  saveResult,
  updateStreak,
  getPersonalBest,
} from "@/utils";
import { isRankEligible } from "@/utils/ranking";
import {
  normalizePhysicalKey,
  recordPhysicalKeypressStats,
  type PhysicalKeypress,
  prepareKeyboardStatsMigration,
} from "@/utils/keyboard-analytics";
import { scheduleKeyboardStatsSync, syncKeyboardStatsNow } from "@/lib/keyboard-stats-cloud";
import type { TestMode, TimedDuration, RunResult, PersonalBest } from "@/types";

import { RankedAuthModal } from "@/components/RankedAuthModal";
import { DevPracticeSelector, type DevPracticeCategory } from "@/components/DevPracticeSelector";
import { SYMBOL_DRILLS, TERMINAL_COMMANDS, ALGORITHM_SNIPPETS, PR_DIFF_SNIPPETS, type CategorySnippet } from "@/data/dev-practice-snippets";

// The results screen only shows after a run, so it loads on demand (and is warmed while idle).
const ResultsScreen = lazy(() => import("@/components/ResultsScreen").then((module) => ({ default: module.ResultsScreen })));

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const ranked = useRankedGame();
  const daily = useDailyGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isRanked,
    challenge: rankedChallenge,
    rankedStatus,
    verifiedResult,
    error: rankedError,
    submit: submitRanked,
  } = ranked;
  const [showRankedAuthModal, setShowRankedAuthModal] = useState(false);
  const { preferences, setPreference } = usePreferences();
  const userIdRef = useRef<string | null>(user?.$id ?? null);
  const [devCategory, setDevCategory] = useState<DevPracticeCategory>("public");
  const [language, setLanguage] = useState("All");
  const [mode, setMode] = useState<TestMode>("snippet");
  const [duration, setDuration] = useState<TimedDuration | null>(null);
  const [customSnippet, setCustomSnippet] = useState<import("@/types").Snippet | null>(null);
  const { getRandomSnippet: getPublicSnippet, loading: isLoadingSource } = useSnippets(language, preferences.snippetLength);
  const getRandomSnippet = useCallback(() => {
    // Daily mode wins over every other source so resets keep today's code.
    if (daily.snippetRef.current) return daily.snippetRef.current;
    if (customSnippet) return customSnippet;
    if (devCategory === "diff") {
      const list = PR_DIFF_SNIPPETS;
      return list[Math.floor(Math.random() * list.length)];
    }
    if (devCategory === "symbols") {
      const list = SYMBOL_DRILLS;
      return list[Math.floor(Math.random() * list.length)];
    }
    if (devCategory === "terminal") {
      const list = TERMINAL_COMMANDS;
      return list[Math.floor(Math.random() * list.length)];
    }
    if (devCategory === "algorithms") {
      const list = ALGORITHM_SNIPPETS;
      return list[Math.floor(Math.random() * list.length)];
    }
    return getPublicSnippet();
  }, [customSnippet, devCategory, getPublicSnippet]);

  const config = useMemo(() => ({ mode, duration }), [mode, duration]);
  const {
    snippet,
    input,
    status,
    elapsedMs,
    wpmSnapshots,
    progressSnapshots,
    handleKey: engineHandleKey,
    reset,
    stop,
    snippetsCompleted,
    secondsRemaining,
    keystrokes,
    mistakes,
    errorHistory,
    completedCorrectChars,
    loadSnippet,
    combo,
    maxCombo,
  } = useGame({ config, getSnippet: getRandomSnippet, autoIndent: preferences.autoIndent });

  const [result, setResult] = useState<RunResult | null>(null);
  const [previousBest, setPreviousBest] = useState<PersonalBest | null>(null);
  const [goalRefreshKey, setGoalRefreshKey] = useState(0);
  const [editorFocusMode, setEditorFocusMode] = useState(false);
  const playKeyboardSound = useKeyboardSound(preferences.keyboardSound, preferences.keyboardSoundProfile, preferences.keyboardSoundVolume, preferences.keyboardSoundTuning);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousSelectionRef = useRef({ language, mode, duration, devCategory, snippetLength: preferences.snippetLength });
  const submittedRankedSessionRef = useRef<string | null>(null);
  const physicalKeypressesRef = useRef<PhysicalKeypress[]>([]);
  const lastPhysicalKeyAtRef = useRef<number | null>(null);
  const keypressFlushTimerRef = useRef<number | null>(null);

  const flushPhysicalKeypresses = useCallback(() => {
    if (keypressFlushTimerRef.current !== null) {
      window.clearTimeout(keypressFlushTimerRef.current);
      keypressFlushTimerRef.current = null;
    }
    if (physicalKeypressesRef.current.length === 0) return;
    recordPhysicalKeypressStats(physicalKeypressesRef.current, userIdRef.current);
    physicalKeypressesRef.current = [];
    if (userIdRef.current) scheduleKeyboardStatsSync(userIdRef.current);
  }, []);

  const resetPhysicalKeypresses = useCallback(() => {
    flushPhysicalKeypresses();
    lastPhysicalKeyAtRef.current = null;
  }, [flushPhysicalKeypresses]);

  useEffect(() => () => flushPhysicalKeypresses(), [flushPhysicalKeypresses]);

  useEffect(() => {
    userIdRef.current = user?.$id ?? null;
    if (user?.$id) {
      prepareKeyboardStatsMigration(user.$id);
      void syncKeyboardStatsNow(user.$id);
    }
  }, [user]);

  const focusWorkspace = useCallback(() => {
    requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    focusWorkspace();
  }, [focusWorkspace]);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    const selectionChanged = previous.language !== language
      || previous.mode !== mode
      || previous.duration !== duration
      || previous.devCategory !== devCategory
      || previous.snippetLength !== preferences.snippetLength;

    previousSelectionRef.current = { language, mode, duration, devCategory, snippetLength: preferences.snippetLength };
    if (selectionChanged && (status === "idle" || status === "finished")) {
      setResult(null);
      resetPhysicalKeypresses();
      reset();
      focusWorkspace();
    }
  }, [language, mode, duration, devCategory, preferences.snippetLength, status, reset, focusWorkspace, resetPhysicalKeypresses]);

  useEffect(() => {
    if (status === "finished" && keystrokes > 0) {
      const currentCorrect = [...input].filter((c, i) => c === snippet.code[i]).length;
      const correct = completedCorrectChars + currentCorrect;
      const wpm = computeWpm(correct, elapsedMs);
      const acc = keystrokes === 0 ? 100 : Math.round(((keystrokes - mistakes) / keystrokes) * 1000) / 10;
      const rawWpm = computeRawWpm(keystrokes, elapsedMs);
      const consistency = computeConsistency(wpmSnapshots);
      const perLineStats = config.mode === "snippet"
        ? computePerLineStats(snippet.code, input, errorHistory)
        : [];

      const r: RunResult = {
        snippetId: snippet.id,
        filename: snippet.filename,
        sourceRepo: snippet.source?.repo,
        language: snippet.language,
        wpm,
        accuracy: acc,
        duration: Math.round(elapsedMs),
        charsTyped: keystrokes,
        timestamp: Date.now(),
        mode: config.mode,
        rawWpm: rawWpm,
        consistency,
        totalErrors: mistakes,
        totalCorrect: correct,
        perLineStats,
        errorPositions: errorHistory,
        snippetsCompleted,
        targetChars: snippet.code.length,
        sourceType: snippet.sourceType ?? "public",
        wpmSnapshots,
        progressSnapshots,
        snippetLength: config.mode === "snippet" ? preferences.snippetLength : undefined,
        maxCombo,
      };
      setResult(r);
      const isCustom = snippet.sourceType === "custom";
      const pb = isCustom ? null : getPersonalBest(r.language, r.mode, r.duration, r.snippetLength);
      setPreviousBest(pb);

      // Persist the last buffered keys before any result/history operation can fail.
      // Keyboard analytics also applies to custom practice, even though its run is not ranked or synced.
      flushPhysicalKeypresses();
      if (userIdRef.current) {
        void syncKeyboardStatsNow(userIdRef.current).then((synced) => {
          if (!synced) console.warn("Keyboard analytics sync is pending and will retry.");
        });
      }

      if (!isCustom) try {
        saveResult(r);
        updateStreak();
        setGoalRefreshKey((key) => key + 1);
        if (!isRanked && userIdRef.current && isRankEligible(r)) {
          void uploadRun(userIdRef.current, r)
            .then(() => setGoalRefreshKey((key) => key + 1))
            .catch((error) => console.error("Unable to save cloud run", error));
        }
      } catch {
        // localStorage may be unavailable
      }
    }
  }, [status, snippet, input, elapsedMs, wpmSnapshots, config.mode, snippetsCompleted, keystrokes, mistakes, errorHistory, completedCorrectChars, isRanked, preferences.snippetLength, config.duration, progressSnapshots, flushPhysicalKeypresses]);

  useEffect(() => {
    if (
      status !== "finished"
      || !result
      || !user
      || !isRanked
      || !rankedChallenge
      || submittedRankedSessionRef.current === rankedChallenge.sessionId
    ) return;

    submittedRankedSessionRef.current = rankedChallenge.sessionId;
    void submitRanked({
      completedCode: input,
      mistakes,
      keystrokes: result.charsTyped,
      correctChars: result.totalCorrect,
      totalMs: Math.round(elapsedMs),
      language: snippet.language,
      mode: config.mode,
      snippetLength: preferences.snippetLength,
      durationSeconds: config.duration ?? undefined,
    });
  }, [status, result, user, isRanked, rankedChallenge, submitRanked, input, snippet.language, mistakes, elapsedMs, config.mode, config.duration, preferences.snippetLength]);

  useEffect(() => {
    if (!rankedChallenge) submittedRankedSessionRef.current = null;
  }, [rankedChallenge]);

  // Daily attempts submit once per session; the hook ignores repeats.
  useEffect(() => {
    if (status !== "finished" || !result || !daily.active) return;
    void daily.submit({
      completedCode: input,
      mistakes,
      keystrokes: result.charsTyped,
      correctChars: result.totalCorrect,
      totalMs: Math.round(elapsedMs),
    });
  }, [status, result, daily.active, daily.submit, input, mistakes, elapsedMs]);

  const enterDaily = useCallback(async () => {
    if (ranked.isRanked) ranked.exitRanked();
    resetPhysicalKeypresses();
    setCustomSnippet(null);
    setResult(null);
    setMode("snippet");
    setDuration(null);
    // Keep the selection effect from resetting away from the daily snippet.
    previousSelectionRef.current = { language, mode: "snippet", duration: null, devCategory, snippetLength: preferences.snippetLength };
    const snippet = await daily.enter(user?.$id ?? null);
    if (snippet) {
      loadSnippet(snippet);
      focusWorkspace();
    }
  }, [ranked, daily, user, language, devCategory, preferences.snippetLength, loadSnippet, focusWorkspace, resetPhysicalKeypresses]);

  const exitDaily = useCallback(() => {
    daily.exit();
    resetPhysicalKeypresses();
    setResult(null);
    loadSnippet(getPublicSnippet());
    focusWorkspace();
  }, [daily, getPublicSnippet, loadSnippet, focusWorkspace, resetPhysicalKeypresses]);

  // /?daily=1 (from the daily board) jumps straight into today's challenge.
  const dailyParam = searchParams.get("daily");
  const dailyParamHandledRef = useRef(false);
  useEffect(() => {
    // Wait for sign-in to resolve so a signed-in player gets a verified attempt.
    if (!dailyParam || authLoading || dailyParamHandledRef.current) return;
    dailyParamHandledRef.current = true;
    setSearchParams((params) => {
      params.delete("daily");
      return params;
    }, { replace: true });
    void enterDaily();
  }, [dailyParam, authLoading, setSearchParams, enterDaily]);

  const handleRetry = useCallback(() => {
    setResult(null);
    resetPhysicalKeypresses();

    if (daily.active) {
      void daily.retry(Boolean(user));
      reset();
      focusWorkspace();
      return;
    }

    if (isRanked && user) {
      void ranked.fetchChallenge({
        language,
        mode,
        snippetLength: preferences.snippetLength,
        durationSeconds: duration ?? 30,
      }).then((ch) => {
        loadSnippet({
          id: ch.sessionId,
          language: ch.language,
          code: ch.snippetCode,
          sourceType: "public",
        });
        focusWorkspace();
      }).catch(() => undefined);
      return;
    }

    reset();
    focusWorkspace();
  }, [isRanked, user, ranked, daily, language, mode, preferences.snippetLength, duration, loadSnippet, reset, focusWorkspace, resetPhysicalKeypresses]);

  const handleDevCategoryChange = useCallback(
    (cat: DevPracticeCategory) => {
      if (daily.active) daily.exit();
      resetPhysicalKeypresses();
      setDevCategory(cat);
      setCustomSnippet(null);
      setResult(null);
      reset();
      focusWorkspace();
    },
    [daily, reset, focusWorkspace, resetPhysicalKeypresses],
  );

  const handleLanguageChange = useCallback(
    (lang: string) => {
      if (daily.active) daily.exit();
      setLanguage(lang);
      setCustomSnippet(null);
      focusWorkspace();
    },
    [daily, focusWorkspace],
  );

  const handleModeChange = useCallback(
    (newMode: TestMode, newDuration: TimedDuration | null) => {
      setMode(newMode);
      setDuration(newDuration);
      setCustomSnippet(null);
      focusWorkspace();
    },
    [focusWorkspace],
  );

  const handleZenStop = useCallback(() => {
    if (mode === "zen" && status === "running") {
      stop();
    }
  }, [mode, status, stop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest('[role="dialog"]'))
      ) {
        return;
      }

      const modifier = e.metaKey || e.ctrlKey;
      const shortcut = modifier
        ? `mod+${e.shiftKey ? "shift+" : ""}${e.key.toLowerCase()}`
        : "";

      if (shortcut === preferences.focusShortcut) {
        e.preventDefault();
        setEditorFocusMode((active) => !active);
        return;
      }

      if (shortcut === preferences.restartShortcut) {
        e.preventDefault();
        handleRetry();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (editorFocusMode) {
          setEditorFocusMode(false);
          return;
        }
        handleRetry();
        return;
      }

      if (status === "finished") {
        if (e.key === "Enter") {
          e.preventDefault();
          handleRetry();
        }
        return;
      }

      const physicalKey = normalizePhysicalKey(e.code, e.key, e.location);
      if (physicalKey) {
        const now = performance.now();
        const expected = snippet.code[input.length] ?? "";
        let isError: boolean | undefined;

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          isError = e.key !== expected;
        } else if (e.key === "Enter") {
          isError = expected !== "\n";
        } else if (e.key === "Tab") {
          isError = expected !== "\t" && expected !== " ";
        } else if (e.key === "Backspace") {
          isError = input.length === 0;
        }

        physicalKeypressesRef.current.push({
          key: physicalKey,
          delayMs: lastPhysicalKeyAtRef.current === null ? 0 : now - lastPhysicalKeyAtRef.current,
          isError,
        });
        lastPhysicalKeyAtRef.current = now;
        if (keypressFlushTimerRef.current === null) {
          keypressFlushTimerRef.current = window.setTimeout(flushPhysicalKeypresses, 750);
        }
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (ranked.isRanked) ranked.recordKeypress();
        if (daily.active) daily.recordKeypress();
        playKeyboardSound(e.key);
        engineHandleKey(e.key);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (ranked.isRanked) ranked.recordKeypress();
        if (daily.active) daily.recordKeypress();
        playKeyboardSound("Backspace");
        engineHandleKey("Backspace");
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (mode === "zen" && status === "running") {
          stop();
          return;
        }
        if (ranked.isRanked) ranked.recordKeypress();
        if (daily.active) daily.recordKeypress();
        playKeyboardSound("Tab");
        engineHandleKey("\t");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (ranked.isRanked) ranked.recordKeypress();
        if (daily.active) daily.recordKeypress();
        playKeyboardSound("Enter");
        engineHandleKey("\n");
      }
    },
    [status, mode, input, snippet.code, engineHandleKey, handleRetry, stop, playKeyboardSound, editorFocusMode, preferences.focusShortcut, preferences.restartShortcut, flushPhysicalKeypresses, ranked, daily.active, daily.recordKeypress],
  );

  const charStates = useMemo(() => computeCharStates(snippet.code, input), [snippet.code, input]);
  const accuracy = useMemo(
    () => keystrokes === 0 ? 100 : Math.round(((keystrokes - mistakes) / keystrokes) * 1000) / 10,
    [keystrokes, mistakes],
  );
  const correctChars = useMemo(
    () => completedCorrectChars + [...input].filter((c, i) => c === snippet.code[i]).length,
    [completedCorrectChars, input, snippet.code],
  );
  const wpm = useMemo(() => computeWpm(correctChars, elapsedMs), [correctChars, elapsedMs]);
  const progress = useMemo(
    () => {
      if (mode === "timed" && duration) {
        return Math.min(100, Math.max(0, ((duration - secondsRemaining) / duration) * 100));
      }
      if (mode === "zen") return 100;
      return Math.min(100, (input.length / snippet.code.length) * 100);
    },
    [input.length, snippet.code.length, mode, duration, secondsRemaining],
  );

  const languages = useMemo(() => getLanguages(), []);

  const ghostState = useGhostRunner({
    enabled: preferences.ghostRunner,
    snippetId: snippet.id,
    snippetCodeLength: snippet.code.length,
    language: snippet.language,
    mode: config.mode,
    duration: config.duration,
    snippetLength: preferences.snippetLength,
    status,
    elapsedMs,
    userWpm: wpm,
    userInputLength: input.length,
  });

  const handleCustomSnippet = useCallback((nextSnippet: import("@/types").Snippet) => {
    resetPhysicalKeypresses();
    previousSelectionRef.current = { language: nextSnippet.language, mode: "snippet", duration: null, devCategory, snippetLength: preferences.snippetLength };
    setCustomSnippet(nextSnippet);
    setLanguage(nextSnippet.language);
    setMode("snippet");
    setDuration(null);
    setResult(null);
    loadSnippet(nextSnippet);
    focusWorkspace();
  }, [loadSnippet, focusWorkspace, devCategory, preferences.snippetLength, resetPhysicalKeypresses]);

  const exitCustomPractice = useCallback(() => {
    resetPhysicalKeypresses();
    setCustomSnippet(null);
    setResult(null);
    const nextSnippet = getPublicSnippet();
    setLanguage("All");
    previousSelectionRef.current = { language: "All", mode: "snippet", duration: null, devCategory: "public", snippetLength: preferences.snippetLength };
    loadSnippet(nextSnippet);
    focusWorkspace();
  }, [getPublicSnippet, loadSnippet, focusWorkspace, preferences.snippetLength, resetPhysicalKeypresses]);

  // /?drill=<char> (from keyboard analytics) opens a drill for that key.
  const drillParam = searchParams.get("drill");
  useEffect(() => {
    if (!drillParam) return;
    setSearchParams((params) => {
      params.delete("drill");
      return params;
    }, { replace: true });
    const drill = buildDrillSnippet([drillParam]);
    if (drill) handleCustomSnippet(drill);
  }, [drillParam, setSearchParams, handleCustomSnippet]);

  const handleNextSnippet = useCallback(() => {
    setResult(null);
    resetPhysicalKeypresses();
    if (daily.active) {
      exitDaily();
      return;
    }
    if (customSnippet) {
      exitCustomPractice();
      return;
    }
    reset();
    focusWorkspace();
  }, [daily.active, exitDaily, customSnippet, exitCustomPractice, reset, focusWorkspace, resetPhysicalKeypresses]);

  const rankedSwitchPending = rankedStatus === "requesting_challenge";
  const rankedSwitchEngaged = isRanked || rankedSwitchPending;
  const handleActivityModeToggle = useCallback(() => {
    if (rankedStatus === "requesting_challenge") return;
    resetPhysicalKeypresses();
    if (daily.active) daily.exit();

    if (status === "running" || status === "finished") {
      setResult(null);
      reset();
    }

    if (isRanked) {
      ranked.exitRanked();
      return;
    }

    if (!user) {
      setShowRankedAuthModal(true);
      return;
    }

    void ranked.fetchChallenge({
      language,
      mode,
      snippetLength: preferences.snippetLength,
      durationSeconds: duration ?? 30,
    }).then((ch) => {
      loadSnippet({
        id: ch.sessionId,
        language: ch.language,
        code: ch.snippetCode,
        sourceType: "public",
      });
    }).catch(() => undefined);
  }, [status, rankedStatus, isRanked, ranked, daily, user, language, mode, preferences.snippetLength, duration, loadSnippet, reset, resetPhysicalKeypresses]);

  return (
    <div
      ref={containerRef}
      className="workspace-shell min-h-screen bg-background transition-colors duration-300 outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <Header />

        {result && daily.active && <DailyResultBanner status={daily.status} outcome={daily.outcome} error={daily.error} />}
        {result ? (
          <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl border bg-card/50" aria-busy="true" />}>
          <ResultsScreen
            result={result}
            previousBest={previousBest}
            verifiedResult={verifiedResult}
            rankedStatus={rankedStatus}
            rankedError={rankedError}
            onRetry={handleRetry}
            onNext={handleNextSnippet}
            onDrill={handleCustomSnippet}
          />
          </Suspense>
        ) : (
          <main className="mt-6 flex flex-col gap-4 animate-scale-in">
            {/* Ranked Competitive Banner */}
            {ranked.isRanked && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-yellow-500/15 p-4 backdrop-blur-md shadow-[0_0_40px_rgba(245,158,11,0.15)] animate-fade-in-up">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-amber-500 text-zinc-950 font-black text-lg shadow-md">
                      ⚡
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-amber-400 flex items-center gap-2">
                        RANKED MATCH ACTIVE
                        <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 font-bold text-amber-400">⚡ Min 20 WPM</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 font-bold text-amber-400">🎯 Min 90% Accuracy</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-background/50 border px-2 py-0.5 text-muted-foreground">🔐 Server Challenge</span>
                      </div>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={ranked.exitRanked} className="border-amber-500/40 text-amber-400 hover:bg-amber-500/20">
                    Switch to Practice
                  </Button>
                </div>
              </div>
            )}

            {!user && ranked.isRanked && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-400 font-semibold flex items-center justify-between gap-2">
                <span>⚠️ Sign in with GitHub is required to record server-verified runs on the Ranked Leaderboard.</span>
              </div>
            )}

            {daily.active ? (
              <DailyModeBanner challenge={daily.challenge} status={daily.status} error={daily.error} onExit={exitDaily} />
            ) : (
              !ranked.isRanked && !customSnippet && (
                <DailyChallengeCard compact userId={user?.$id} onPlay={() => void enterDaily()} disabled={status === "running" || daily.status === "loading"} />
              )
            )}
            {!daily.active && daily.status === "rejected" && daily.error && (
              <p className="-mt-3 text-center text-xs text-red-500">{daily.error}</p>
            )}

            {/* One compact toolbar keeps every setting in reach and the editor near the top. */}
            <section className="practice-toolbar glass-card flex flex-col gap-2 rounded-2xl p-2" aria-label="Practice settings">
              <div className="flex flex-wrap items-center gap-2">
                <div className={cn("mode-switch", rankedSwitchEngaged && "is-ranked")} role="group" aria-label="Game mode">
                  <button
                    type="button"
                    disabled={rankedSwitchPending}
                    aria-pressed={!rankedSwitchEngaged}
                    onClick={() => { if (isRanked) handleActivityModeToggle(); }}
                    title="Practice: local runs"
                  >
                    <Coffee className="size-3.5" /> Practice
                  </button>
                  <button
                    type="button"
                    disabled={rankedSwitchPending}
                    aria-pressed={rankedSwitchEngaged}
                    onClick={() => { if (!isRanked) handleActivityModeToggle(); }}
                    title="Ranked: server-verified runs"
                  >
                    {rankedSwitchPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                    {rankedSwitchPending ? "Syncing" : "Ranked"}
                  </button>
                </div>
                <span className="hidden h-6 w-px bg-border/70 sm:block" aria-hidden="true" />
                <ModeSelector
                  mode={mode}
                  duration={duration}
                  onSelect={handleModeChange}
                  disabled={status === "running" || daily.active}
                  isRunningZen={mode === "zen" && status === "running"}
                  onStopZen={handleZenStop}
                />
                <span className="hidden h-6 w-px bg-border/70 sm:block" aria-hidden="true" />
                <div className="flex items-center gap-0.5" role="group" aria-label="Snippet length">
                  {(["short", "medium", "long"] as const).map((item) => {
                    const lengthLocked = status === "running" || Boolean(customSnippet) || daily.active;
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={lengthLocked}
                        onClick={() => setPreference("snippetLength", item)}
                        aria-pressed={preferences.snippetLength === item}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer",
                          preferences.snippetLength === item
                            ? "bg-foreground text-background shadow-xs font-bold"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          lengthLocked && "opacity-40 pointer-events-none"
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                {/* When the custom-code panel opens it takes the full toolbar width. */}
                <div className="ml-auto flex flex-wrap items-center gap-2 has-[>section]:ml-0 has-[>section]:basis-full">
                  <WeakKeyDrillModal onDrill={handleCustomSnippet} />
                  <CustomPractice onLoad={handleCustomSnippet} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                <DevPracticeSelector
                  activeCategory={devCategory}
                  onSelectCategory={handleDevCategoryChange}
                  disabled={status === "running"}
                />
                {devCategory === "public" && (
                  <LanguagePicker
                    languages={languages}
                    selected={language}
                    onSelect={handleLanguageChange}
                    disabled={status === "running"}
                    loading={isLoadingSource}
                  />
                )}
              </div>
            </section>
            {rankedStatus === "rejected" && rankedError && (
              <p className="-mt-2 text-center font-mono text-[10px] text-red-500">RANKED ERROR: {rankedError}</p>
            )}

            {customSnippet && <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-card/60 px-3 py-2 text-xs"><span><strong>{customSnippet.id.startsWith("drill-") ? "Weak-key drill" : "Local practice"}</strong> · not saved or ranked</span><button type="button" onClick={exitCustomPractice} className="text-muted-foreground hover:text-foreground">Exit {customSnippet.id.startsWith("drill-") ? "drill" : "custom"}</button></div>}

            {"title" in snippet && (snippet as CategorySnippet).title && (
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 backdrop-blur-sm flex items-center justify-between gap-3 text-xs shadow-xs",
                  (snippet as CategorySnippet).category === "diff"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-primary/20 bg-primary/10"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {(snippet as CategorySnippet).category === "diff" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 text-zinc-950 px-2 py-0.5 text-[10px] font-mono font-black shrink-0">
                        {(snippet as CategorySnippet).prNumber || "PR"}
                      </span>
                    )}
                    <span className="font-bold text-foreground font-mono text-xs truncate">
                      {(snippet as CategorySnippet).title}
                    </span>
                  </div>
                  {(snippet as CategorySnippet).description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-sans font-medium">
                      {(snippet as CategorySnippet).description}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-mono uppercase px-2.5 py-1 rounded-md font-bold tracking-wider shrink-0",
                    (snippet as CategorySnippet).category === "diff"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-primary/20 text-primary"
                  )}
                >
                  {(snippet as CategorySnippet).category === "diff"
                    ? "PR Git Diff"
                    : `${(snippet as CategorySnippet).category} drill`}
                </span>
              </div>
            )}

            <StatsBar
              wpm={wpm}
              accuracy={accuracy}
              elapsedSeconds={elapsedMs / 1000}
              progress={progress}
              mode={mode}
              secondsRemaining={secondsRemaining}
              snippetsCompleted={snippetsCompleted}
              totalChars={input.length}
              ghostState={ghostState}
              onToggleGhost={() => setPreference("ghostRunner", !preferences.ghostRunner)}
              isGhostEnabled={preferences.ghostRunner}
            />

            <CodeDisplay
              chars={charStates}
              filename={snippet.filename ?? "snippet"}
              language={snippet.language}
              source={snippet.source}
              input={input}
              onClick={() => containerRef.current?.focus()}
              focusMode={editorFocusMode}
              onFocusModeChange={(active) => { setEditorFocusMode(active); focusWorkspace(); }}
              focusStats={{
                wpm,
                accuracy,
                time: mode === "timed" ? `${secondsRemaining}s left` : `${(elapsedMs / 1000).toFixed(1)}s`,
              }}
              onRestart={handleRetry}
              isRunning={status === "running"}
              ghostCharIndex={ghostState.hasPb ? ghostState.ghostCharIndex : null}
              ghostWpm={ghostState.hasPb ? ghostState.targetWpm : null}
              combo={combo}
              maxCombo={maxCombo}
            />

            {preferences.keyboard3d && (
              <Keyboard3D
                className="hidden md:block"
                nextChar={snippet.code[input.length]}
                active={status !== "finished"}
                combo={preferences.comboEffects ? combo : 0}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <DailyGoals refreshKey={goalRefreshKey} compact />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl glass-card px-3 py-2 text-[11px] text-muted-foreground shadow-xs">
                <Button type="button" variant="ghost" size="sm" onClick={handleRetry} className="h-7 px-2 text-xs font-semibold hover:text-foreground">
                  <RotateCcw className="size-3.5 mr-1" /> Restart
                </Button>
                <span className="font-sans text-muted-foreground/90">
                  {status === "idle" ? "Start typing to begin" : mode === "zen" ? "Zen: Tab to stop" : "Typing…"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono shadow-xs">Esc</kbd> restart
                </span>
                <span className="inline-flex items-center gap-1">
                  <IndentIncrease aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
                  <kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono shadow-xs">Tab</kbd> {mode === "zen" ? "stop" : "indent"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CornerDownLeft aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
                  <kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono shadow-xs">Enter</kbd> newline
                </span>
              </div>
            </div>
          </main>
        )}
      </div>
      <RankedAuthModal isOpen={showRankedAuthModal} onClose={() => setShowRankedAuthModal(false)} />
      <Footer />
    </div>
  );
}
