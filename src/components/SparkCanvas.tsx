import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

export interface SparkCanvasHandle {
  spawn: (x: number, y: number, combo: number) => void;
  burst: (x: number, y: number, combo: number) => void;
}

interface Particle {
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
  flow: ["#38bdf8", "#06b6d4", "#67e8f9", "#ffffff"],
  fever: ["#fbbf24", "#f59e0b", "#d97706", "#fde047"],
  overdrive: ["#f59e0b", "#ec4899", "#a855f7", "#38bdf8", "#ffffff"],
};

export const SparkCanvas = forwardRef<SparkCanvasHandle, { disabled?: boolean }>(function SparkCanvas(
  { disabled = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // subtle gravity
      p.vx *= 0.96; // air drag
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 2.5;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (particles.length > 0) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    } else {
      animFrameRef.current = null;
    }
  }, []);

  const ensureRunning = useCallback(() => {
    if (animFrameRef.current === null && particlesRef.current.length > 0) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  const spawnParticles = useCallback(
    (x: number, y: number, combo: number, countMultiplier = 1) => {
      if (disabled || combo < 5) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const colors =
        combo >= 100
          ? TIER_COLORS.overdrive
          : combo >= 50
          ? TIER_COLORS.fever
          : TIER_COLORS.flow;

      const baseCount = combo >= 100 ? 7 : combo >= 50 ? 5 : combo >= 20 ? 3 : 2;
      const count = Math.min(24, Math.round(baseCount * countMultiplier));

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 2.2 + 0.8) * (combo >= 100 ? 1.4 : 1);
        const color = colors[Math.floor(Math.random() * colors.length)];

        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2, // slight upward bias
          size: Math.random() * 2 + 1.2,
          alpha: 1,
          color,
          decay: Math.random() * 0.035 + 0.025,
        });
      }

      // Limit particle array size
      if (particlesRef.current.length > 120) {
        particlesRef.current.splice(0, particlesRef.current.length - 120);
      }

      ensureRunning();
    },
    [disabled, ensureRunning]
  );

  useImperativeHandle(
    ref,
    () => ({
      spawn: (x, y, combo) => spawnParticles(x, y, combo, 1),
      burst: (x, y, combo) => spawnParticles(x, y, combo, 3),
    }),
    [spawnParticles]
  );

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
