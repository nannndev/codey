import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { STREAK_EVENT } from "@/utils/storage";
import { isMilestone, tierFor, type FlameTier } from "@/lib/streak";
import { KapMascot } from "./KapMascot";

const SHOW_MS = 4800;

interface Celebration {
  days: number;
  tier: FlameTier | null;
  milestone: boolean;
  /** A new flame reached today, e.g. Blaze at 7 days. */
  newTier: FlameTier | null;
  restarted: boolean;
}

/** Kap hops in when a run extends the streak; milestones get a bigger moment. */
export function StreakCelebration() {
  const [shown, setShown] = useState<Celebration | null>(null);

  useEffect(() => {
    const onStreak = (event: Event) => {
      const change = (event as CustomEvent<{ from: number; to: number }>).detail;
      if (!change || change.to <= change.from) return;
      const tier = tierFor(change.to);
      const before = tierFor(change.from);
      setShown({ days: change.to, tier, milestone: isMilestone(change.to), newTier: tier && tier.id !== before?.id && change.to > 1 ? tier : null, restarted: change.from === 0 });
    };
    window.addEventListener(STREAK_EVENT, onStreak);
    return () => window.removeEventListener(STREAK_EVENT, onStreak);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), shown.milestone ? SHOW_MS + 1500 : SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const title = shown.milestone ? `${shown.days}-day milestone!` : shown.restarted ? "Streak started!" : `Day ${shown.days}!`;
  const body = shown.newTier
    ? `Your flame grew into ${shown.newTier.name}. Keep going.`
    : shown.restarted ? "Kap is lit. Come back tomorrow to make it two." : "Practice done for today. Kap is burning bright.";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4" aria-live="polite">
      <div className="streak-toast pointer-events-auto relative flex items-center gap-3 rounded-2xl border bg-popover/95 py-2 pl-2 pr-9 text-popover-foreground shadow-2xl backdrop-blur-md">
        <KapMascot mood="lit" tier={shown.tier} size={64} jump className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight" style={{ color: shown.tier?.flame }}>{title}</p>
          <p className="max-w-60 text-xs text-muted-foreground">{body}</p>
        </div>
        <button type="button" onClick={() => setShown(null)} className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
