import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PodiumScene } from "./PodiumScene";

export interface PodiumEntry {
  rank: 1 | 2 | 3;
  /** Card shown under the pedestal. */
  card: ReactNode;
  onSelect: () => void;
  /** An unclaimed spot: shows the card but no mascot. */
  empty?: boolean;
}

interface Podium3DProps {
  entries: PodiumEntry[];
  /** Rendered instead when WebGL is unavailable. */
  fallback: ReactNode;
}

const DEFAULT_POSITIONS: Record<1 | 2 | 3, number> = { 1: 0.5, 2: 0.18, 3: 0.82 };

/**
 * 3D podium with Keybot mascots (three.js, loaded on demand). The cards are
 * plain HTML, positioned under each pedestal from the scene's projection.
 */
export function Podium3D({ entries, fallback }: Podium3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PodiumScene | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [hovered, setHovered] = useState<1 | 2 | 3 | null>(null);
  const filledKey = entries.filter((entry) => !entry.empty).map((entry) => entry.rank).sort().join(",");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const filled = new Set(filledKey.split(",").map(Number));
    void import("./PodiumScene")
      .then(({ PodiumScene }) => {
        if (cancelled) return;
        try {
          sceneRef.current = new PodiumScene(
            host,
            ([1, 2, 3] as const).map((rank) => ({ rank, filled: filled.has(rank) })),
            {
              onHover: setHovered,
              onSelect: (rank) => entriesRef.current.find((entry) => entry.rank === rank)?.onSelect(),
              onLayout: setPositions,
            },
          );
          setReady(true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [filledKey]);

  if (failed) return <>{fallback}</>;

  return (
    <section className="podium-3d relative overflow-hidden rounded-2xl border bg-card/65 backdrop-blur-sm" aria-label="Top three typists">
      <div className="podium-glow pointer-events-none absolute inset-0" />
      <div ref={hostRef} className={`relative h-[260px] w-full transition-opacity duration-500 sm:h-[330px] ${ready ? "opacity-100" : "opacity-0"}`} />
      <div className="relative h-[196px] sm:h-[178px]">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className={`podium-card absolute top-0 max-w-[230px] -translate-x-1/2 transition-transform duration-200 ${hovered === entry.rank ? "-translate-y-1" : ""}`}
            // As wide as the gap between neighbouring pedestals allows.
            style={{ left: `${positions[entry.rank] * 100}%`, width: `calc(${(positions[1] - positions[2]) * 100}% - 10px)` }}
            onPointerEnter={() => sceneRef.current?.highlight(entry.rank)}
          >
            {entry.card}
          </div>
        ))}
      </div>
    </section>
  );
}
