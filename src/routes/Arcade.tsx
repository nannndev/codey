import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flame, Gamepad2, Heart, Lock, Pause, Play, RotateCcw, Sparkles, Timer, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import { useKeyboardSound } from "@/hooks";
import { scheduleKeyboardStatsSync } from "@/lib/keyboard-stats-cloud";
import { normalizePhysicalKey, recordPhysicalKeypressStats } from "@/utils/keyboard-analytics";
import { playComboLostSound, playComboMilestoneSound } from "@/utils/combo-audio";
import { ArcadeEngine, ROUND_MS, grade, type ArcadeEvent, type ArcadeStats, type EngineState, type Judgment } from "@/lib/arcade-engine";
import { getColorway, resolveKeyColors } from "@/lib/keycaps";
import { keysForChar } from "@/lib/keyboard-layout";
import type { ArcadeScene, LaneSkin } from "@/components/arcade/ArcadeScene";
import { cn } from "@/lib/utils";

const KEY_SETS = {
  home: { name: "Home row", keys: ["A", "S", "D", "F", "J", "K", "L", ";"] },
  top: { name: "Top row", keys: ["Q", "W", "E", "R", "U", "I", "O", "P"] },
  code: { name: "Code symbols", keys: ["(", ")", "{", "}", "[", "]", ";", "="] },
} as const;
type KeySetId = keyof typeof KEY_SETS;

const LEGACY_HIGH_SCORE_KEY = "codey_arcade_high_score";
const highScoreKey = (set: KeySetId) => `codey_arcade_high_score_v2_${set}`;

function readHighScore(set: KeySetId) {
  try {
    const stored = localStorage.getItem(highScoreKey(set));
    if (stored !== null) return Number(stored) || 0;
    // The old single high score came from the home-row game.
    return set === "home" ? Number(localStorage.getItem(LEGACY_HIGH_SCORE_KEY) || 0) : 0;
  } catch {
    return 0;
  }
}

const JUDGMENT_STYLES: Record<Judgment, string> = {
  perfect: "text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]",
  great: "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]",
  good: "text-emerald-300",
  miss: "text-red-400",
};

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || !!el.closest?.('[role="dialog"]'));
}

export default function Arcade() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const playSound = useKeyboardSound(preferences.keyboardSound, preferences.keyboardSoundProfile, preferences.keyboardSoundVolume, preferences.keyboardSoundTuning);

  const [keySet, setKeySet] = useState<KeySetId>("home");
  const [gameState, setGameState] = useState<EngineState>("ready");
  const [hud, setHud] = useState<ArcadeStats>(() => new ArcadeEngine().snapshot());
  const [highScore, setHighScore] = useState(() => readHighScore("home"));
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [popup, setPopup] = useState<{ judgment: Judgment; points?: number; id: number } | null>(null);
  const [banner, setBanner] = useState<{ text: string; id: number } | null>(null);
  const [sceneError, setSceneError] = useState(false);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(new ArcadeEngine(8));
  const sceneRef = useRef<ArcadeScene | null>(null);
  const pressedRef = useRef(new Set<number>());
  const lastKeyAtRef = useRef<number | null>(null);
  const popupIdRef = useRef(0);
  const highScoreRef = useRef(highScore);
  highScoreRef.current = highScore;

  const lanes = KEY_SETS[keySet].keys;
  const laneSkins = useMemo<LaneSkin[]>(() => {
    const colorway = getColorway(preferences.keycapTheme);
    return lanes.map((label) => {
      const id = keysForChar(label.toLowerCase())[0] ?? label;
      const colors = resolveKeyColors(id, colorway, preferences.keycapOverrides);
      return { label, cap: colors.cap ?? "#2b2e3b", legend: colors.legend ?? "#eef0f6" };
    });
  }, [lanes, preferences.keycapTheme, preferences.keycapOverrides]);
  const accent = getColorway(preferences.keycapTheme)?.glow ?? "#f59e0b";

  const showPopup = useCallback((judgment: Judgment, points?: number) => {
    setPopup({ judgment, points, id: ++popupIdRef.current });
  }, []);

  const handleEvents = useCallback((events: ArcadeEvent[]) => {
    const engine = engineRef.current;
    for (const event of events) {
      if (event.type === "miss") {
        showPopup("miss");
      } else if (event.type === "levelup") {
        setBanner({ text: `Level ${event.level}`, id: ++popupIdRef.current });
      } else if (event.type === "overdrive" && !event.active) {
        setBanner({ text: "Overdrive over", id: ++popupIdRef.current });
      } else if (event.type === "finished") {
        const final = engine.snapshot().score;
        setGameState("finished");
        setHud(engine.snapshot());
        if (final > highScoreRef.current) {
          highScoreRef.current = final;
          setHighScore(final);
          setIsNewHigh(true);
          try {
            localStorage.setItem(highScoreKey(keySet), String(final));
          } catch {
            // ignore
          }
        }
      }
    }
    sceneRef.current?.handle(events);
  }, [keySet, showPopup]);

  // Dev-only handle for automated play tests; stripped from production builds.
  if (import.meta.env.DEV) (window as unknown as { __arcadeEngine?: typeof engineRef }).__arcadeEngine = engineRef;

  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;
  const skinsRef = useRef({ laneSkins, accent });
  skinsRef.current = { laneSkins, accent };

  // Scene + render loop. three.js is loaded on demand so it never weighs on
  // the rest of the app.
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    let cancelled = false;
    let frame = 0;
    let lastHud = 0;

    void import("@/components/arcade/ArcadeScene")
      .then(({ ArcadeScene }) => {
        if (cancelled) return;
        try {
          sceneRef.current = new ArcadeScene(host, skinsRef.current.laneSkins, skinsRef.current.accent);
        } catch {
          setSceneError(true);
          return;
        }
        const loop = (now: number) => {
          const engine = engineRef.current;
          const events = engine.update(now);
          if (events.length) handleEventsRef.current(events);
          sceneRef.current?.frame(engine, pressedRef.current);
          if (engine.state === "running" && (events.length || now - lastHud > 120)) {
            lastHud = now;
            setHud(engine.snapshot());
          }
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      })
      .catch(() => setSceneError(true));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // Built once; lane and color changes go through setLanes below.
  }, []);

  useEffect(() => {
    sceneRef.current?.setLanes(laneSkins, accent);
  }, [laneSkins, accent]);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (engine.state === "paused") {
      engine.resume(performance.now());
      setGameState("running");
      return;
    }
    engineRef.current = new ArcadeEngine(lanes.length);
    engineRef.current.start(performance.now());
    setHud(engineRef.current.snapshot());
    setIsNewHigh(false);
    setPopup(null);
    setBanner({ text: "Go!", id: ++popupIdRef.current });
    setGameState("running");
  }, [lanes.length]);

  const pauseGame = useCallback(() => {
    engineRef.current.pause();
    setGameState("paused");
  }, []);

  const resetGame = useCallback(() => {
    engineRef.current = new ArcadeEngine(lanes.length);
    setHud(engineRef.current.snapshot());
    setPopup(null);
    setGameState("ready");
  }, [lanes.length]);

  const chooseKeySet = useCallback((next: KeySetId) => {
    setKeySet(next);
    setHighScore(readHighScore(next));
    engineRef.current = new ArcadeEngine(KEY_SETS[next].keys.length);
    setHud(engineRef.current.snapshot());
    setGameState("ready");
  }, []);

  useEffect(() => {
    const laneFor = (key: string) => lanes.findIndex((label) => label === key || label === key.toUpperCase());

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const engine = engineRef.current;

      if (event.key === "Escape") {
        if (engine.state === "running") pauseGame();
        else if (engine.state === "paused") startGame();
        return;
      }
      if (event.key === "Enter" && engine.state !== "running") {
        event.preventDefault();
        startGame();
        return;
      }
      if (engine.state !== "running") return;

      if (event.key === " ") {
        event.preventDefault();
        if (engine.activateOverdrive()) {
          setBanner({ text: "Overdrive ×2", id: ++popupIdRef.current });
          sceneRef.current?.handle([{ type: "overdrive", active: true }]);
          setHud(engine.snapshot());
        }
        return;
      }

      const lane = laneFor(event.key);
      if (lane === -1) return;
      event.preventDefault();
      if (event.repeat) return;

      pressedRef.current.add(lane);
      sceneRef.current?.press(lane);
      playSound(event.key);

      // Bring the clock up to the keypress itself rather than the last frame.
      const pending = engine.update(performance.now());
      if (pending.length) handleEventsRef.current(pending);
      if (engine.state !== "running") return;
      const comboBefore = engine.snapshot().combo;
      const result = engine.press(lane);
      if (result?.type === "hit") {
        sceneRef.current?.handle([result]);
        showPopup(result.judgment, result.points);
        const combo = comboBefore + 1;
        if (preferences.comboEffects && combo % 25 === 0) playComboMilestoneSound(combo, preferences.keyboardSoundVolume / 100);
      } else if (result?.type === "ghost" && comboBefore >= 10 && preferences.comboEffects) {
        playComboLostSound(preferences.keyboardSoundVolume / 100);
      }
      setHud(engine.snapshot());

      const physicalKey = normalizePhysicalKey(event.code, event.key, event.location);
      if (physicalKey) {
        const now = performance.now();
        recordPhysicalKeypressStats([{
          key: physicalKey,
          delayMs: lastKeyAtRef.current === null ? 0 : now - lastKeyAtRef.current,
          isError: result?.type !== "hit",
        }], user?.$id);
        lastKeyAtRef.current = now;
        if (user?.$id) scheduleKeyboardStatsSync(user.$id, 2500);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const lane = laneFor(event.key);
      if (lane !== -1) pressedRef.current.delete(lane);
    };
    // Pause instead of burning lives while the tab is hidden.
    const onVisibility = () => {
      if (document.hidden && engineRef.current.state === "running") pauseGame();
    };
    const onBlur = () => pressedRef.current.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lanes, pauseGame, startGame, playSound, showPopup, preferences.comboEffects, preferences.keyboardSoundVolume, user?.$id]);

  const result = grade(hud.counts);
  const seconds = Math.ceil(hud.remainingMs / 1000);
  const overdriveReady = hud.overdriveMeter >= 100 && !hud.overdriveActive;

  return (
    <div className="arcade-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <Link to="/" className="inline-flex items-center gap-2.5 text-sm font-bold hover:opacity-80 transition-opacity">
            <ArrowLeft className="size-4 text-amber-500" />
            <span className="text-lg font-black tracking-tight">Codey<span className="text-amber-500">_</span> Arcade</span>
          </Link>
          <div className="flex items-center gap-1 rounded-full border bg-card/60 p-1 text-xs font-semibold">
            {(Object.keys(KEY_SETS) as KeySetId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseKeySet(id)}
                disabled={gameState === "running"}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  keySet === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {KEY_SETS[id].name}
              </button>
            ))}
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[220px_minmax(560px,1fr)_220px]">
          {/* Left HUD: score, combo, time */}
          <aside className="order-2 grid grid-cols-3 gap-3 lg:order-1 lg:grid-cols-1 lg:self-start">
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 sm:p-5 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-400">Score</span>
                <Trophy className="size-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight sm:text-3xl">{hud.score.toLocaleString()}</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Best: <span className="font-bold text-amber-400">{highScore.toLocaleString()}</span></p>
            </div>

            <div className={cn("rounded-2xl border p-4 sm:p-5 shadow-lg transition-all", hud.combo >= 10 ? "border-amber-500/50 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-border bg-card/80")}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Combo</span>
                {hud.combo >= 10 ? <Flame className="size-4 animate-pulse text-amber-500" /> : <Sparkles className="size-4 text-sky-400" />}
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight sm:text-3xl">{hud.combo}<span className="ml-1.5 text-base text-amber-400">×{hud.multiplier}</span></p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Best: <span className="font-bold text-foreground">{hud.bestCombo}</span></p>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4 sm:p-5 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Time</span>
                <Timer className="size-4 text-sky-400" />
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight sm:text-3xl">{seconds}s</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Level {hud.level} / 5</p>
            </div>
          </aside>

          {/* Stage */}
          <div className={cn("arcade-stage order-1 relative min-h-[560px] overflow-hidden border lg:order-2", hud.overdriveActive && "is-overdrive")}>
            <div ref={canvasHostRef} className="absolute inset-0" />

            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/40 px-5 py-3 text-white backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Gamepad2 className="size-5 text-amber-400" />
                <div>
                  <p className="text-sm font-black tracking-tight">KEYCAP HIGHWAY</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{KEY_SETS[keySet].name} · Level {hud.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gameState === "running" && (
                  <button type="button" onClick={pauseGame} className="arcade-icon-button" aria-label="Pause">
                    <Pause className="size-4" />
                  </button>
                )}
                <button type="button" onClick={resetGame} className="arcade-icon-button" aria-label="Reset">
                  <RotateCcw className="size-4" />
                </button>
              </div>
            </div>

            {/* Overdrive meter */}
            <div className="absolute left-4 right-4 top-[68px] z-10 flex items-center gap-3">
              <Zap className={cn("size-4 shrink-0", hud.overdriveActive || overdriveReady ? "text-amber-300" : "text-white/40")} />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-150", hud.overdriveActive ? "bg-amber-300" : overdriveReady ? "animate-pulse bg-amber-400" : "bg-sky-400")}
                  style={{ width: `${hud.overdriveActive ? engineRef.current.overdriveProgress() * 100 : hud.overdriveMeter}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right font-mono text-[10px] font-bold uppercase tracking-wider text-white/70">
                {hud.overdriveActive ? "Overdrive ×2" : overdriveReady ? "Space: Overdrive" : "Overdrive"}
              </span>
            </div>

            {banner && (
              <div key={banner.id} className="arcade-banner pointer-events-none absolute inset-x-0 top-[34%] z-20 text-center font-black uppercase tracking-[0.3em] text-white" onAnimationEnd={() => setBanner(null)}>
                {banner.text}
              </div>
            )}

            {popup && (
              <div key={popup.id} className={cn("arcade-popup pointer-events-none absolute inset-x-0 top-[52%] z-20 text-center font-black uppercase tracking-widest", JUDGMENT_STYLES[popup.judgment])}>
                <span className="text-2xl sm:text-3xl">{popup.judgment}</span>
                {popup.points !== undefined && <span className="ml-2 font-mono text-base text-white/80">+{popup.points}</span>}
              </div>
            )}

            {sceneError && (
              <div className="absolute inset-0 z-20 grid place-items-center p-6 text-center text-sm text-white/80">
                Your browser couldn't start WebGL, which the 3D arcade needs. Try another browser or enable hardware acceleration.
              </div>
            )}

            {gameState !== "running" && !sceneError && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-6 backdrop-blur-sm animate-fade-in">
                <div className="arcade-end-panel w-full max-w-lg rounded-3xl border border-amber-500/40 bg-card/95 p-7 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
                  <div className="flex items-center justify-between border-b border-border/60 pb-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-400">
                      <Zap className="size-3.5" />
                      {gameState === "finished" ? "Round over" : gameState === "paused" ? "Paused" : "Keycap Highway"}
                    </span>
                    <span className="size-2.5 animate-ping rounded-full bg-amber-400" />
                  </div>

                  {gameState === "finished" ? (
                    <>
                      <div className="mt-5 flex items-center gap-5">
                        <span className="arcade-grade grid size-20 shrink-0 place-items-center rounded-2xl border border-amber-500/50 bg-amber-500/10 font-mono text-5xl font-black text-amber-400">
                          {result.letter}
                        </span>
                        <div className="min-w-0">
                          <p className="text-3xl font-black tabular-nums">{hud.score.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.accuracy.toFixed(1)}% accuracy · best combo {hud.bestCombo}
                          </p>
                          {isNewHigh && <p className="mt-1 text-xs font-black text-amber-400">New high score!</p>}
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                        {(["perfect", "great", "good", "miss"] as Judgment[]).map((judgment) => (
                          <div key={judgment} className="rounded-xl border bg-muted/30 py-2">
                            <p className={cn("font-mono text-lg font-black tabular-nums", JUDGMENT_STYLES[judgment])}>{hud.counts[judgment]}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{judgment}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                        {gameState === "paused" ? "Paused" : "Keycap Highway"}
                      </h1>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Press each keycap's key as it lands on its target. Perfect timing fills the Overdrive meter; press <b className="text-foreground">Space</b> when it's full for double points. Every 10 hits raises your multiplier, and a {30}-hit streak restores a heart.
                      </p>
                    </>
                  )}

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={startGame}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-black text-zinc-950 shadow-lg transition-transform hover:bg-amber-400 active:scale-95"
                    >
                      <Play className="size-4" />
                      {gameState === "paused" ? "Resume" : gameState === "finished" ? "Play again" : "Start"}
                    </button>
                    <p className="text-center font-mono text-[11px] text-muted-foreground sm:text-right">
                      Keys: <span className="font-bold text-foreground">{lanes.join(" ")}</span><br />
                      Enter start · Esc pause · Space overdrive
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right HUD: lives and judgments */}
          <aside className="order-3 space-y-4 lg:self-start">
            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Lives</span>
                <span className="text-xs font-bold text-muted-foreground">{hud.lives} / 5</span>
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Heart
                    key={index}
                    className={cn(
                      "size-6 transition-all duration-300",
                      index < hud.lives ? "fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" : "fill-muted/20 text-border/40",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-lg">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Timing</p>
              <div className="space-y-1.5 font-mono text-xs">
                {(["perfect", "great", "good", "miss"] as Judgment[]).map((judgment) => (
                  <div key={judgment} className="flex items-center justify-between">
                    <span className={cn("font-bold uppercase", JUDGMENT_STYLES[judgment])}>{judgment}</span>
                    <span className="tabular-nums text-foreground">{hud.counts[judgment]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">Round: {ROUND_MS / 1000}s · windows ±50 / 100 / 150 ms</p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border bg-card/80 p-5 text-xs leading-relaxed text-muted-foreground shadow-lg">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Lock className="size-3.5 text-emerald-400" /> Private telemetry
              </div>
              <p className="text-[11px]">
                Arcade runs are separate from ranked WPM. Your key accuracy here still feeds your personal Keyboard Analytics heatmap. Keycaps use your Keycap Studio colors.
              </p>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}
