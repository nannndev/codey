import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flame, Gamepad2, Heart, Lock, Pause, Play, RotateCcw, Sparkles, Timer, Trophy, Volume2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import { useKeyboardSound } from "@/hooks";
import { scheduleKeyboardStatsSync } from "@/lib/keyboard-stats-cloud";
import { normalizePhysicalKey, recordPhysicalKeypressStats } from "@/utils/keyboard-analytics";

const LANES = ["A", "S", "D", "F", "J", "K", "L", ";"] as const;
const PATTERNS = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 2, 1, 3, 4, 6, 5, 7],
  [0, 7, 1, 6, 2, 5, 3, 4],
  [0, 1, 0, 2, 3, 2, 4, 5, 4, 6, 7, 6],
] as const;

interface FallingKey {
  id: number;
  key: string;
  lane: number;
  spawnedAt: number;
  durationMs: number;
}

type GameState = "ready" | "running" | "paused" | "finished";

const HIGH_SCORE_KEY = "codey_arcade_high_score";

export default function Arcade() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const playSound = useKeyboardSound(preferences.keyboardSound, preferences.keyboardSoundProfile, preferences.keyboardSoundVolume, preferences.keyboardSoundTuning);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [notes, setNotes] = useState<FallingKey[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    } catch {
      return 0;
    }
  });
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lives, setLives] = useState(5);
  const [seconds, setSeconds] = useState(45);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const [activeLaneIndex, setActiveLaneIndex] = useState<number | null>(null);
  const [hitFeedbackText, setHitFeedbackText] = useState<string | null>(null);

  const gameRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(gameState);
  const notesRef = useRef<FallingKey[]>([]);
  const sequenceRef = useRef(0);
  const patternRef = useRef(0);
  const idRef = useRef(0);
  const lastKeyAtRef = useRef<number | null>(null);

  useEffect(() => { stateRef.current = gameState; }, [gameState]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => {
    if (gameState === "paused" || gameState === "finished") setNotes([]);
  }, [gameState]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      } catch {
        // ignore
      }
    }
  }, [score, highScore]);

  const difficulty = useMemo(() => Math.min(4, 1 + Math.floor((45 - seconds) / 11)), [seconds]);

  const resetGame = useCallback(() => {
    setGameState("ready");
    setNotes([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLives(5);
    setSeconds(45);
    sequenceRef.current = 0;
    patternRef.current = Math.floor(Math.random() * PATTERNS.length);
    requestAnimationFrame(() => gameRef.current?.focus());
  }, []);

  const startGame = useCallback(() => {
    if (gameState === "paused") {
      setGameState("running");
      gameRef.current?.focus();
      return;
    }
    setNotes([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLives(5);
    setSeconds(45);
    sequenceRef.current = 0;
    patternRef.current = Math.floor(Math.random() * PATTERNS.length);
    setGameState("running");
    requestAnimationFrame(() => gameRef.current?.focus());
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "running") return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setGameState("finished");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "running") return;
    let spawnTimer = 0;
    let cancelled = false;
    const spawn = () => {
      if (cancelled || stateRef.current !== "running") return;
      const pattern = PATTERNS[patternRef.current];
      const lane = pattern[sequenceRef.current % pattern.length];
      sequenceRef.current += 1;
      if (sequenceRef.current % pattern.length === 0) patternRef.current = (patternRef.current + 1) % PATTERNS.length;
      const durationMs = Math.max(1750, 3400 - difficulty * 360);
      const note: FallingKey = { id: ++idRef.current, key: LANES[lane], lane, spawnedAt: performance.now(), durationMs };
      setNotes((current) => [...current, note]);
      window.setTimeout(() => {
        setNotes((current) => {
          if (!current.some((item) => item.id === note.id)) return current;
          setCombo(0);
          setLives((value) => {
            const next = value - 1;
            if (next <= 0) setGameState("finished");
            return Math.max(0, next);
          });
          setFlash("miss");
          setHitFeedbackText("MISS!");
          window.setTimeout(() => { setFlash(null); setHitFeedbackText(null); }, 200);
          return current.filter((item) => item.id !== note.id);
        });
      }, durationMs + 180);
      const beat = Math.max(260, 760 - difficulty * 105);
      spawnTimer = window.setTimeout(spawn, beat);
    };
    spawnTimer = window.setTimeout(spawn, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(spawnTimer);
    };
  }, [gameState, difficulty]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (gameState === "running") setGameState("paused");
      else if (gameState === "paused") setGameState("running");
      return;
    }
    if (event.key === "Enter" && (gameState === "ready" || gameState === "finished")) {
      startGame();
      return;
    }
    if (gameState !== "running") return;
    const pressed = event.key.toUpperCase();
    const laneIndex = LANES.indexOf(pressed as typeof LANES[number]);
    if (laneIndex === -1) return;

    event.preventDefault();
    playSound(event.key);

    setActiveLaneIndex(laneIndex);
    window.setTimeout(() => setActiveLaneIndex(null), 120);

    const now = performance.now();
    const candidate = [...notesRef.current]
      .filter((note) => note.key === pressed)
      .sort((a, b) => b.spawnedAt - a.spawnedAt)
      .find((note) => {
        const progress = (now - note.spawnedAt) / note.durationMs;
        return progress >= 0.68 && progress <= 1.08;
      });
    const isHit = Boolean(candidate);
    const physicalKey = normalizePhysicalKey(event.code, event.key, event.location);
    if (physicalKey) {
      recordPhysicalKeypressStats([{
        key: physicalKey,
        delayMs: lastKeyAtRef.current === null ? 0 : now - lastKeyAtRef.current,
        isError: !isHit,
      }], user?.$id);
      lastKeyAtRef.current = now;
      if (user?.$id) scheduleKeyboardStatsSync(user.$id, 2500);
    }

    if (!candidate) {
      setCombo(0);
      setScore((value) => Math.max(0, value - 25));
      setFlash("miss");
      setHitFeedbackText("MISS!");
      window.setTimeout(() => { setFlash(null); setHitFeedbackText(null); }, 150);
      return;
    }

    const progress = (now - candidate.spawnedAt) / candidate.durationMs;
    const precision = Math.max(0, 1 - Math.abs(0.9 - progress) * 3.5);
    const earnedPoints = Math.round(80 + precision * 70 + Math.min(combo + 1, 30) * 4);

    setNotes((current) => current.filter((note) => note.id !== candidate.id));
    setCombo((value) => {
      const next = value + 1;
      setBestCombo((best) => Math.max(best, next));
      setScore((current) => current + earnedPoints);
      return next;
    });

    const label = precision > 0.7 ? `⚡ PERFECT +${earnedPoints}` : `GOOD +${earnedPoints}`;
    setHitFeedbackText(label);
    setFlash("hit");
    window.setTimeout(() => { setFlash(null); setHitFeedbackText(null); }, 150);
  }, [gameState, playSound, startGame, combo, user?.$id]);

  return (
    <div className="arcade-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <Link to="/" className="inline-flex items-center gap-2.5 text-sm font-bold hover:opacity-80 transition-opacity">
            <ArrowLeft className="size-4 text-amber-500" />
            <span className="text-lg font-black tracking-tight">Codey<span className="text-amber-500">_</span> Arcade</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-card/60 border px-3 py-1.5 rounded-full">
            <Volume2 className="size-3.5 text-amber-400" /> Mechanical Switch Audio Active
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[220px_minmax(560px,1fr)_220px]">
          {/* Left HUD: Score, Combo, Timer */}
          <aside className="order-2 grid grid-cols-3 gap-3 lg:order-1 lg:grid-cols-1 lg:self-start">
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-amber-400">Score</span>
                <Trophy className="size-4 text-amber-400" />
              </div>
              <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{score.toLocaleString()}</p>
              {highScore > 0 && (
                <p className="text-[11px] text-muted-foreground font-medium mt-1">High Score: <span className="font-bold text-amber-400">{highScore.toLocaleString()}</span></p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 sm:p-5 shadow-lg transition-all ${combo >= 10 ? "border-amber-500/50 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-border bg-card/80"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground">Combo</span>
                {combo >= 10 ? <Flame className="size-4 text-amber-500 animate-pulse" /> : <Sparkles className="size-4 text-sky-400" />}
              </div>
              <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{combo}x</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">Best: <span className="font-bold text-foreground">{bestCombo}x</span></p>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground">Time Left</span>
                <Timer className="size-4 text-sky-400" />
              </div>
              <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{seconds}s</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">Level {difficulty} Speed</p>
            </div>
          </aside>

          {/* Center Stage: Rhythm Falling Notes */}
          <div
            ref={gameRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={`arcade-stage order-1 relative min-h-[560px] overflow-hidden border outline-none lg:order-2 ${flash ? `is-${flash}` : ""}`}
          >
            {/* Top Stage Bar */}
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-card/80 px-5 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Gamepad2 className="size-5 text-amber-400" />
                <div>
                  <p className="text-sm font-black tracking-tight text-foreground">CODE RAIN PROTOCOL</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Pattern Engine · Level {difficulty}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gameState === "running" && (
                  <button type="button" onClick={() => setGameState("paused")} className="arcade-icon-button" aria-label="Pause arcade">
                    <Pause className="size-4" />
                  </button>
                )}
                {(gameState === "paused" || gameState === "finished") && (
                  <button type="button" onClick={startGame} className="arcade-icon-button" aria-label="Resume arcade">
                    <Play className="size-4 text-amber-400" />
                  </button>
                )}
                <button type="button" onClick={resetGame} className="arcade-icon-button" aria-label="Reset arcade">
                  <RotateCcw className="size-4" />
                </button>
              </div>
            </div>

            {/* Vertical Lane Grid & Active Glow Columns */}
            <div className="absolute inset-0 grid grid-cols-8 pt-16 pointer-events-none">
              {LANES.map((key, i) => (
                <div key={key} className={`relative border-r border-border/40 last:border-r-0 ${activeLaneIndex === i ? "bg-amber-500/10 shadow-[inset_0_0_30px_rgba(245,158,11,0.2)]" : ""}`} />
              ))}
            </div>

            {/* Target Laser Scan Line */}
            <div className="arcade-scanline" />

            {/* Hit Feedback Float Banner */}
            {hitFeedbackText && (
              <div className={`absolute bottom-28 left-1/2 -translate-x-1/2 z-20 font-black text-sm uppercase tracking-widest px-4 py-1.5 rounded-full border shadow-lg animate-bounce ${
                flash === "hit" ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-emerald-500/20" : "bg-red-500/20 border-red-500/60 text-red-400 shadow-red-500/20"
              }`}>
                {hitFeedbackText}
              </div>
            )}

            {/* Falling Note Blocks */}
            {notes.map((note) => (
              <div
                key={note.id}
                className="arcade-note"
                style={{
                  left: `calc(${note.lane * 12.5}% + 6.25%)`,
                  animationDuration: `${note.durationMs}ms`,
                }}
              >
                <span>{note.key}</span>
              </div>
            ))}

            {/* Bottom Key Target Markers */}
            <div className="absolute inset-x-0 bottom-6 z-10 grid grid-cols-8 px-2">
              {LANES.map((key, idx) => {
                const isPressed = activeLaneIndex === idx;
                return (
                  <div
                    key={key}
                    className={`mx-auto grid size-11 place-items-center font-black rounded-xl border transition-all duration-100 ${
                      isPressed
                        ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.8)] scale-110"
                        : "bg-card/90 text-foreground border-border shadow-md"
                    } sm:size-13 text-base`}
                  >
                    {key}
                  </div>
                );
              })}
            </div>

            {/* Start / Pause / Finish Modal Overlay */}
            {gameState !== "running" && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-background/85 p-6 backdrop-blur-md animate-fade-in">
                <div className="arcade-end-panel w-full max-w-lg border border-amber-500/40 bg-card/95 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)]">
                  <div className="flex items-center justify-between border-b border-border/60 pb-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-400 flex items-center gap-1.5">
                      <Zap className="size-3.5" />
                      {gameState === "finished" ? "Sesi Berakhir" : gameState === "paused" ? "Game Di-pause" : "Rhythm Key Protocol"}
                    </span>
                    <span className="size-2.5 rounded-full bg-amber-400 animate-ping" />
                  </div>

                  <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl text-foreground">
                    {gameState === "finished" ? "🎮 Game Over!" : "Code Rain Arcade"}
                  </h1>

                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground font-medium">
                    {gameState === "finished"
                      ? "Bagus sekali! Coba lagi untuk menaikkan rekor combo dan mengasah reflek mengetikmu."
                      : "Tekan tombol keyboard (A S D F · J K L ;) saat blok huruf yang jatuh menyentuh garis target laser!"}
                  </p>

                  {gameState === "finished" && (
                    <div className="mt-6 grid grid-cols-2 rounded-2xl border bg-muted/30 p-4 text-center">
                      <div>
                        <p className="text-2xl font-black tabular-nums text-amber-400">{score.toLocaleString()}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Final Score</p>
                      </div>
                      <div className="border-l border-border/60">
                        <p className="text-2xl font-black tabular-nums text-sky-400">{bestCombo}x</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Best Combo</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={startGame}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-3.5 text-sm font-black text-zinc-950 shadow-lg transition-transform active:scale-95"
                    >
                      <Play className="size-4" />
                      {gameState === "paused" ? "Lanjutkan Game" : gameState === "finished" ? "Main Lagi" : "Mulai Arcade"}
                    </button>
                    <p className="text-[11px] font-mono text-muted-foreground text-center sm:text-right">
                      Tombol: <span className="font-bold text-foreground">A S D F · J K L ;</span><br />
                      Esc = Pause · Enter = Start
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right HUD: Lives & Telemetry Info */}
          <aside className="order-3 space-y-4 lg:self-start">
            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground">Sisa Nyawa</span>
                <span className="text-xs text-muted-foreground font-bold">{lives} / 5</span>
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Heart
                    key={index}
                    className={`size-6 transition-all duration-300 ${
                      index < lives
                        ? "fill-red-500 text-red-500 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                        : "text-border/40 fill-muted/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-5 text-xs leading-relaxed text-muted-foreground shadow-lg space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Lock className="size-3.5 text-emerald-400" /> Private Telemetry
              </div>
              <p className="text-[11px]">
                Mode Arcade berdiri sendiri di luar WPM ranked. Akurasi ketikan fisik tombol di mode ini otomatis tersinkron ke **Keyboard Analytics Heatmap** pribadi kamu.
              </p>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}
