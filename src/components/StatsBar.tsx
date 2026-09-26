import { cn } from "@/lib/utils";
import type { TestMode } from "@/types";
import { Gauge, Target, Timer, Clock, Ghost, Layers, Hash } from "lucide-react";

interface StatsBarProps {
  wpm: number;
  accuracy: number;
  elapsedSeconds: number;
  progress: number;
  mode: TestMode;
  secondsRemaining: number;
  snippetsCompleted: number;
  totalChars: number;
  ghostState?: {
    hasPb: boolean;
    targetWpm: number;
    deltaWpm: number;
    deltaChars: number;
  };
  onToggleGhost?: () => void;
  isGhostEnabled?: boolean;
}

/** Accuracy badges only mean something once typing has started. */
function keystrokesStarted(wpm: number, accuracy: number) {
  return wpm > 0 || accuracy < 100;
}

function Stat({ icon: Icon, label, value, valueClass, large, badge }: {
  icon: typeof Gauge;
  label: string;
  value: string;
  valueClass?: string;
  large?: boolean;
  badge?: { label: string; class: string };
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <Icon aria-hidden="true" className="size-3.5 self-center text-muted-foreground/70" />
      <span className={cn("font-mono font-black tabular-nums tracking-tight text-foreground", large ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl", valueClass)}>
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {badge && <span className={cn("self-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase", badge.class)}>{badge.label}</span>}
    </div>
  );
}

export function StatsBar({
  wpm,
  accuracy,
  elapsedSeconds,
  progress,
  mode,
  secondsRemaining,
  snippetsCompleted,
  totalChars,
  ghostState,
  onToggleGhost,
  isGhostEnabled = true,
}: StatsBarProps) {
  const isTimed = mode === "timed";
  const isZen = mode === "zen";
  const timeLow = isTimed && secondsRemaining <= 5;
  const hasGhost = Boolean(ghostState?.hasPb);

  const speedTier =
    wpm >= 100
      ? { label: "Master", class: "bg-purple-500/15 text-purple-400 border border-purple-500/30" }
      : wpm >= 75
      ? { label: "Expert", class: "bg-amber-500/15 text-amber-400 border border-amber-500/30" }
      : wpm >= 50
      ? { label: "Fast", class: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" }
      : { label: "Pace", class: "bg-muted text-muted-foreground" };

  const accuracyBadge =
    accuracy >= 98
      ? { label: "Flawless", class: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" }
      : accuracy >= 93
      ? { label: "Good", class: "bg-blue-500/15 text-blue-400 border border-blue-500/30" }
      : { label: "Focus", class: "bg-rose-500/15 text-rose-400 border border-rose-500/30" };

  const timeValue = isTimed ? `${secondsRemaining}s` : `${elapsedSeconds.toFixed(1)}s`;
  const accuracyColor = accuracy >= 95 ? "text-emerald-500 dark:text-emerald-400" : accuracy >= 90 ? "text-amber-500" : "text-rose-500";
  const delta = ghostState?.deltaWpm ?? 0;

  // One compact line so the editor sits near the top of the page.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1 px-1" aria-live="off">
        <Stat icon={Gauge} label="wpm" value={wpm.toFixed(1)} large badge={wpm > 0 ? speedTier : undefined} />
        <Stat icon={Target} label="acc" value={`${accuracy.toFixed(1)}%`} valueClass={accuracyColor} badge={accuracy > 0 && keystrokesStarted(wpm, accuracy) ? accuracyBadge : undefined} />
        <Stat
          icon={isTimed ? Timer : Clock}
          label={isTimed ? "left" : "time"}
          value={timeValue}
          valueClass={timeLow ? "text-rose-500 animate-pulse" : undefined}
        />
        {isZen && (
          <>
            <Stat icon={Layers} label="snippets" value={String(snippetsCompleted)} />
            <Stat icon={Hash} label="chars" value={String(totalChars)} />
          </>
        )}
        {hasGhost && (
          <button
            type="button"
            onClick={onToggleGhost}
            className={cn(
              "mb-0.5 ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors",
              isGhostEnabled ? "border-purple-500/30 bg-purple-500/10 text-purple-500 dark:text-purple-300" : "border-transparent bg-muted text-muted-foreground",
            )}
            title={isGhostEnabled ? "Ghost pace vs your PB: on (click to hide)" : "Ghost pace: off (click to show)"}
          >
            <Ghost className="size-3.5" />
            PB {ghostState?.targetWpm.toFixed(0)}
            {isGhostEnabled && (
              <span className={delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : ""}>
                {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all duration-150 ease-out",
            progress === 0 && "opacity-0"
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
