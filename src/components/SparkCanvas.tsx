import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

export type StrikeIntensity = "subtle" | "full";

export interface SparkCanvasHandle {
  /** Per-keystroke strike at the cursor; scales with combo. */
  spawn: (x: number, y: number, combo: number) => void;
  /** Milestone burst. */
  burst: (x: number, y: number, combo: number) => void;
  /** Wrong key: a few red sparks. */
  miss: (x: number, y: number) => void;
}

interface Particle {
  kind: "dot" | "shard";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  decay: number;
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

      p.x += p.vx;
      p.y += p.vy;
      // Light gravity so sparks fade out above the line instead of falling onto it.
      p.vy += 0.03;
      p.vx *= 0.95;
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;
      if (p.kind === "shard") {
        // Streak along the velocity so shards read as flying debris.
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
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

  // Sparks start just above the cursor and fly upward in a narrow cone, so
  // they never cover the characters still to be typed.
  const debris = useCallback((x: number, y: number, colors: string[], count: number, speedScale: number, kinds: Array<"dot" | "shard">) => {
    if (reducedMotion.current) return;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.6);
      const speed = (Math.random() * 1.4 + 0.9) * speedScale;
      push({
        kind: kinds[i % kinds.length],
        x: x + (Math.random() - 0.5) * 6,
        y: y - 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 0.9 + 0.8,
        alpha: 0.75,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: Math.random() * 0.03 + 0.05,
      });
    }
  }, [push]);

  const spawn = useCallback((x: number, y: number, combo: number) => {
    if (disabled) return;
    const base = combo >= 100 ? 4 : combo >= 50 ? 3 : combo >= 20 ? 2 : 1;
    const count = intensity === "full" ? base : Math.max(1, base - 1);
    debris(x, y, tierColors(combo), count, combo >= 100 ? 1.2 : 1, combo >= 50 ? ["shard", "dot"] : ["dot"]);
  }, [disabled, intensity, debris]);

  const burst = useCallback((x: number, y: number, combo: number) => {
    if (disabled) return;
    debris(x, y, tierColors(combo), intensity === "full" ? 10 : 6, 1.5, ["shard", "dot"]);
  }, [disabled, intensity, debris]);

  const miss = useCallback((x: number, y: number) => {
    if (disabled) return;
    debris(x, y, TIER_COLORS.miss, intensity === "full" ? 3 : 2, 0.9, ["dot"]);
  }, [disabled, intensity, debris]);

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
