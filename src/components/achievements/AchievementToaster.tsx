import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { ACHIEVEMENT_EVENT, type UnlockedBadge } from "@/lib/achievements";
import { AchievementBadge } from "./Badge";

const SHOW_MS = 5200;

/** Announces newly earned badges one at a time, bottom center. */
export function AchievementToaster() {
  const [queue, setQueue] = useState<UnlockedBadge[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = queue[0];

  useEffect(() => {
    const onUnlock = (event: Event) => {
      const badges = (event as CustomEvent<UnlockedBadge[]>).detail ?? [];
      // Several tiers of one family at once: announce only the highest.
      const best = new Map<string, UnlockedBadge>();
      for (const badge of badges) {
        const key = badge.family ?? badge.id;
        const existing = best.get(key);
        if (!existing || (badge.tier ?? 0) > (existing.tier ?? 0)) best.set(key, badge);
      }
      setQueue((items) => [...items, ...best.values()]);
    };
    window.addEventListener(ACHIEVEMENT_EVENT, onUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_EVENT, onUnlock);
  }, []);

  useEffect(() => {
    if (!current) return;
    timerRef.current = setTimeout(() => setQueue((items) => items.slice(1)), SHOW_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current]);

  if (!current) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4" role="status" aria-live="polite">
      <div key={current.id} className="achievement-toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-popover/95 p-3 pr-4 shadow-2xl backdrop-blur-md">
        <div className="achievement-toast__badge shrink-0">
          <AchievementBadge kind={current.family ?? current.single!} tier={current.tier} size={60} label={current.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Achievement unlocked</p>
          <p className="truncate text-base font-black tracking-tight">{current.name}</p>
          <p className="text-xs text-muted-foreground">{current.goal}</p>
          <Link to="/achievements" onClick={() => setQueue((items) => items.slice(1))} className="mt-1 inline-block text-xs font-semibold underline-offset-2 hover:underline">
            See all achievements
          </Link>
        </div>
        <button type="button" onClick={() => setQueue((items) => items.slice(1))} aria-label="Dismiss" className="self-start text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-4" />
        </button>
        {queue.length > 1 && <span className="absolute -top-2 right-3 rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">+{queue.length - 1}</span>}
      </div>
    </div>
  );
}
