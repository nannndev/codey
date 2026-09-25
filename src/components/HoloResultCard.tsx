import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Trophy } from "lucide-react";
import type { PersonalBest, RunResult } from "@/types";
import { usePreferences } from "./PreferencesProvider";
import { getColorway, resolveKeyColors } from "@/lib/keycaps";
import { keyLabel, missedKeys } from "@/lib/keyboard-layout";
import { cn } from "@/lib/utils";

export interface ResultTier {
  label: string;
  /** Foil and highlight color. */
  accent: string;
}

export function resultTier(wpm: number): ResultTier {
  if (wpm >= 100) return { label: "Grandmaster", accent: "#c084fc" };
  if (wpm >= 80) return { label: "Master Typist", accent: "#f59e0b" };
  if (wpm >= 60) return { label: "Pro Coder", accent: "#60a5fa" };
  return { label: "Apprentice", accent: "#34d399" };
}

interface HoloResultCardProps {
  result: RunResult;
  previousBest: PersonalBest | null;
  modeLabel: string;
  username?: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const path = useMemo(() => {
    if (values.length < 2) return "M0 20 L100 20";
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = Math.max(max - min, 10);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 36 - ((value - min) / range) * 32;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values]);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={`${path} L100 40 L0 40 Z`} fill="var(--holo-accent)" opacity="0.14" />
      <path d={path} fill="none" stroke="var(--holo-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function HoloResultCard({ result, previousBest, modeLabel, username }: HoloResultCardProps) {
  const [flipped, setFlipped] = useState(false);
  const tiltRef = useRef<HTMLDivElement>(null);
  const { preferences } = usePreferences();
  const tier = resultTier(result.wpm);
  const wpm = useCountUp(result.wpm);
  const isCustom = result.sourceType === "custom";
  const isNewPb = !isCustom && (previousBest ? result.wpm > previousBest.bestWpm : true);
  const missed = useMemo(() => missedKeys(result.errorPositions), [result.errorPositions]);
  const colorway = getColorway(preferences.keycapTheme);

  // Tilt + foil position follow the pointer, or the device's tilt on phones
  // that expose orientation without a permission prompt. Written straight to
  // CSS variables so movement never re-renders the card.
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const apply = (px: number, py: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--holo-rx", `${(0.5 - py) * 16}deg`);
        el.style.setProperty("--holo-ry", `${(px - 0.5) * 20}deg`);
        el.style.setProperty("--holo-mx", `${px * 100}%`);
        el.style.setProperty("--holo-my", `${py * 100}%`);
        el.style.setProperty("--holo-active", "1");
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--holo-rx", "0deg");
      el.style.setProperty("--holo-ry", "0deg");
      el.style.setProperty("--holo-mx", "50%");
      el.style.setProperty("--holo-my", "30%");
      el.style.setProperty("--holo-active", "0");
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      apply(
        Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      );
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      apply(Math.max(0, Math.min(1, 0.5 + event.gamma / 60)), Math.max(0, Math.min(1, 0.5 + (event.beta - 45) / 60)));
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  const date = new Date(result.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const seconds = Math.round(result.duration / 1000);

  return (
    <div className="holo-scene mx-auto w-full max-w-xl">
      <div
        ref={tiltRef}
        className="holo-tilt"
        style={{ "--holo-accent": tier.accent } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-pressed={flipped}
          aria-label={flipped ? "Result card, back side. Press to show the front." : "Result card. Press to flip for the run breakdown."}
          className={cn("holo-card", flipped && "is-flipped")}
        >
          {/* Front */}
          <div className="holo-face holo-front" aria-hidden={flipped}>
            <div className="holo-foil" />
            <div className="holo-glare" />
            <div className="relative flex h-full flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <img src="/favicon.svg" alt="" className="size-5 shrink-0" />
                  <span className="truncate font-mono text-sm font-bold text-white/90">{username ? `@${username}` : "Codey"}</span>
                </span>
                <span className="holo-chip">{tier.label}</span>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Words per minute</p>
                  <p className="holo-wpm font-mono font-black tabular-nums leading-none">{wpm.toFixed(1)}</p>
                </div>
                {isNewPb && (
                  <span className="mb-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-zinc-950 shadow-lg">
                    <Trophy className="size-3" /> NEW PB
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Accuracy", value: `${result.accuracy.toFixed(1)}%` },
                  { label: "Raw", value: result.rawWpm.toFixed(1) },
                  { label: "Consistency", value: `${result.consistency.toFixed(0)}%` },
                ].map((stat) => (
                  <div key={stat.label} className="holo-tile">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{stat.label}</p>
                    <p className="font-mono text-base font-black tabular-nums text-white sm:text-lg">{stat.value}</p>
                  </div>
                ))}
              </div>

              <Sparkline values={result.wpmSnapshots ?? []} className="h-12 w-full" />

              <div className="mt-auto flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-white/50">
                <span className="truncate">{result.language} · {modeLabel} · {date}</span>
                <span className="flex shrink-0 items-center gap-1"><RotateCw className="size-3" /> Flip</span>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="holo-face holo-back" aria-hidden={!flipped}>
            <div className="holo-foil" />
            <div className="relative flex h-full flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/70">Run breakdown</p>
                <span className="holo-chip">{tier.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Max streak", value: String(result.maxCombo ?? 0) },
                  { label: "Errors", value: String(result.totalErrors) },
                  { label: "Chars", value: String(result.charsTyped) },
                  { label: "Time", value: `${seconds}s` },
                ].map((stat) => (
                  <div key={stat.label} className="holo-tile">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{stat.label}</p>
                    <p className="font-mono text-base font-black tabular-nums text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {missed.length ? "Keys you missed" : "No missed keys. Clean run!"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {missed.map(({ id, count }) => {
                    const colors = resolveKeyColors(id, colorway, preferences.keycapOverrides);
                    return (
                      <span
                        key={id}
                        className="holo-keycap"
                        style={{
                          ...(colors.cap && { "--kc-cap": colors.cap }),
                          ...(colors.legend && { "--kc-legend": colors.legend }),
                        } as React.CSSProperties}
                      >
                        <span className="font-mono text-sm font-black">{keyLabel(id)}</span>
                        <span className="holo-keycap-count">×{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-white/50">
                <span className="truncate">
                  {previousBest ? `Previous PB ${previousBest.bestWpm.toFixed(1)} WPM` : "First run on this format"}
                </span>
                <span className="flex shrink-0 items-center gap-1"><RotateCw className="size-3" /> Flip</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
