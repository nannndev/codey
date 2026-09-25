import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KeyboardStatsMap } from "@/utils/keyboard-analytics";
import type { KeyColumn } from "@/lib/key-metrics";
import type { SkylineScene } from "./SkylineScene";

interface KeyboardSkylineProps {
  columns: KeyColumn[];
  stats: KeyboardStatsMap;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Rendered instead when WebGL is unavailable. */
  fallback: ReactNode;
}

/** 3D keyboard skyline (three.js, loaded on demand) with an HTML hover tooltip. */
export function KeyboardSkyline({ columns, stats, selected, onSelect, fallback }: KeyboardSkylineProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SkylineScene | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    void import("./SkylineScene")
      .then(({ SkylineScene }) => {
        if (cancelled) return;
        try {
          const scene = new SkylineScene(host, {
            onHover: (id, x, y) => setHover(id ? { id, x, y } : null),
            onSelect: (id) => onSelectRef.current(id),
          });
          scene.setColumns(columnsRef.current);
          sceneRef.current = scene;
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
  }, []);

  useEffect(() => { sceneRef.current?.setColumns(columns); }, [columns]);
  useEffect(() => { sceneRef.current?.setSelected(selected); }, [selected]);

  if (failed) return <>{fallback}</>;

  const hovered = hover ? columns.find((column) => column.id === hover.id) : null;
  const hoverStat = hover ? stats[hover.id] : undefined;

  return (
    <div className="relative">
      <div ref={hostRef} className={`skyline-host h-[230px] w-full transition-opacity duration-700 sm:h-[400px] ${ready ? "opacity-100" : "opacity-0"}`} />
      {!ready && <div className="leaderboard-shimmer absolute inset-4 rounded-xl" aria-hidden="true" />}
      {hover && hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border bg-popover/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-md"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-mono text-sm font-black">{hovered.label}</p>
          {hoverStat ? (
            <p className="whitespace-nowrap text-muted-foreground">
              {hoverStat.accuracy.toFixed(1)}% · {hoverStat.avgDelayMs} ms · {hoverStat.totalPresses.toLocaleString()} presses
            </p>
          ) : (
            <p className="text-muted-foreground">Not tracked yet</p>
          )}
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-muted-foreground/80">Drag to rotate · click a key for details</p>
    </div>
  );
}
