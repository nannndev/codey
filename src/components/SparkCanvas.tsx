import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

export type StrikeIntensity = "subtle" | "full";

export interface SparkCanvasHandle {
  /** Per-keystroke strike at the cursor; scales with combo. */
  spawn: (x: number, y: number, combo: number) => void;
  /** Milestone burst with a big shockwave. */
  burst: (x: number, y: number, combo: number) => void;
  /** Wrong key: red shards and ring. */
  miss: (x: number, y: number) => void;
}

interface Particle {
  kind: "dot" | "shard" | "ring";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  decay: number;
  /** Rings: current and max radius. */
  radius?: number;
  maxRadius?: number;
}

const TIER_COLORS = {
  spark: ["#e2e8f0", "#94a3b8", "#cbd5e1"],
  flow: ["#38bdf8", "#06b6d4", "#67e8f9", "#ffffff"],
  fever: ["#fbbf24", "#f59e0b", "#d97706", "#fde047"],
  overdrive: ["#f59e0b", "#ec4899", "#a855f7", "#38bdf8", "#ffffff"],
  miss: ["#ef4444", "#f87171", "#fca5a5"],
};

const MAX_PARTICLES = 160;

function tierColors(combo: number) {
  if (combo >= 100) return TIER_COLORS.overdrive;
  if (combo >= 50) return TIER_COLORS.fever;
  if (combo >= 5) return TIER_COLORS.flow;
  return TIER_COLORS.spark;
}

export const SparkCanvas = forwardRef<SparkCanvasHandle, { disabled?: boolean; intensity?: StrikeIntensity }>(function SparkCanvas(
  { disabled = false, intensity = "full" },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.kind === "ring") {
        // Ease the ring out toward its max radius.
        p.radius! += (p.maxRadius! - p.radius!) * 0.18;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, p.size * p.alpha);
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius!, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.kind === "shard" ? 0.12 : 0.08;
        p.vx *= 0.95;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = p.color;
        if (p.kind === "shard") {
          // Streak along the velocity so shards read as flying debris.
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.6, p.y - p.vy * 2.6);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    animFrameRef.current = particles.length > 0 ? requestAnimationFrame(renderLoop) : null;
  }, []);

  const push = useCallback((particle: Particle) => {
    particlesRef.current.push(particle);
    if (particlesRef.current.length > MAX_PARTICLES) {
      particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
    }
    if (animFrameRef.current === null) animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [renderLoop]);

  const ring = useCallback((x: number, y: number, color: string, maxRadius: number, width: number, decay: number) => {
    if (reducedMotion.current) return;
    push({ kind: "ring", x, y, vx: 0, vy: 0, size: width, alpha: 0.9, color, decay, radius: 2, maxRadius });
  }, [push]);

  const debris = useCallback((x: number, y: number, colors: string[], count: number, speedScale: number, kinds: Array<"dot" | "shard">) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2.4 + 1) * speedScale;
      push({
        kind: kinds[i % kinds.length],
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.3,
        size: Math.random() * 1.6 + 1.1,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: Math.random() * 0.03 + 0.03,
      });
    }
  }, [push]);

  const spawn = useCallback((x: number, y: number, combo: number) => {
    if (disabled) return;
    const full = intensity === "full";
    const colors = tierColors(combo);
    const base = combo >= 100 ? 7 : combo >= 50 ? 5 : combo >= 20 ? 4 : combo >= 5 ? 3 : 2;
    const count = full ? base : Math.max(1, Math.round(base / 2));
    debris(x, y, colors, count, combo >= 100 ? 1.4 : 1, combo >= 20 ? ["shard", "dot"] : ["dot"]);
    // Small impact ring on every strike; bigger as the combo climbs.
    ring(x, y, colors[0], 10 + Math.min(combo, 120) * 0.12, full ? 1.6 : 1, full ? 0.07 : 0.1);
  }, [disabled, intensity, debris, ring]);

  const burst = useCallback((x: number, y: number, combo: number) => {
    if (disabled) return;
    const colors = tierColors(combo);
    debris(x, y, colors, intensity === "full" ? 24 : 12, 1.8, ["shard", "dot"]);
    ring(x, y, colors[0], 90, 3, 0.03);
    ring(x, y, colors[1] ?? colors[0], 55, 2, 0.04);
  }, [disabled, intensity, debris, ring]);

  const miss = useCallback((x: number, y: number) => {
    if (disabled) return;
    debris(x, y, TIER_COLORS.miss, intensity === "full" ? 6 : 3, 1.1, ["shard"]);
    ring(x, y, TIER_COLORS.miss[0], 16, 2, 0.08);
  }, [disabled, intensity, debris, ring]);

  useImperativeHandle(ref, () => ({ spawn, burst, miss }), [spawn, burst, miss]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement || canvas);

    return () => {
      observer.disconnect();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20 block h-full w-full"
      aria-hidden="true"
    />
  );
});
