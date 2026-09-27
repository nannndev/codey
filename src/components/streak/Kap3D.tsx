import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FlameTier } from "@/utils/flame-tiers";
import type { KapLook } from "@/utils/kap-art";
import type { StreakMood } from "@/lib/streak";
import type { KapScene } from "./KapScene";

interface Kap3DProps {
  mood: StreakMood;
  tier: FlameTier | null;
  look: KapLook;
  /** Height in px; the width fills the parent. */
  height: number;
  /** Bounce along with keystrokes. */
  typing?: boolean;
  /** Shown while three.js loads, and instead of it without WebGL. */
  fallback: ReactNode;
  className?: string;
}

/** Kap in 3D (three.js, loaded on demand): drag to spin, click to hop. */
export function Kap3D({ mood, tier, look, height, typing = false, fallback, className }: Kap3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const key = JSON.stringify({ mood, tier: tier?.id ?? null, look, typing });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: KapScene | null = null;
    let cancelled = false;
    const options = JSON.parse(key) as { mood: StreakMood; look: KapLook; typing: boolean };
    void import("./KapScene")
      .then(({ KapScene }) => {
        if (cancelled) return;
        try {
          scene = new KapScene(host, { ...options, tier });
          setState("ready");
        } catch {
          setState("failed");
        }
      })
      .catch(() => setState("failed"));
    return () => {
      cancelled = true;
      scene?.dispose();
    };
    // The key covers every input; tier is read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className={className} style={{ height, position: "relative" }}>
      {state !== "ready" && <div className="absolute inset-0 grid place-items-center">{fallback}</div>}
      <div ref={hostRef} className={`absolute inset-0 transition-opacity duration-500 [&>canvas]:h-full [&>canvas]:w-full ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
