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

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  colorClass?: string;
  badge?: string;
  badgeClass?: string;
}

function StatCard({ icon: Icon, label, value, subValue, colorClass, badge, badgeClass }: StatCardProps) {
  return (
    <div className="glass-card rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-1.5 min-w-0 transition-all duration-200 hover:border-foreground/20 group relative overflow-hidden">
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
          <Icon className="size-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          {label}
        </span>
        {badge && (
          <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wide", badgeClass)}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight", colorClass ?? "text-foreground")}>
          {value}
        </span>
        {subValue && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {subValue}
          </span>
        )}
      </div>
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

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          "grid gap-2 sm:gap-3",
          isZen
            ? hasGhost
              ? "grid-cols-2 sm:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-4"
            : hasGhost
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-3"
        )}
      >
        <StatCard
          icon={Gauge}
          label="WPM"
          value={wpm.toFixed(1)}
          badge={wpm > 0 ? speedTier.label : undefined}
          badgeClass={speedTier.class}
        />

        <StatCard
          icon={Target}
          label="Accuracy"
          value={`${accuracy.toFixed(1)}%`}
          colorClass={
            accuracy >= 95
              ? "text-emerald-500 dark:text-emerald-400"
              : accuracy >= 90
              ? "text-amber-500"
              : "text-rose-500"
          }
          badge={accuracy > 0 ? accuracyBadge.label : undefined}
          badgeClass={accuracyBadge.class}
        />

        {isTimed ? (
          <StatCard
            icon={Timer}
            label="Time left"
            value={`${secondsRemaining}s`}
            colorClass={timeLow ? "text-rose-500 animate-pulse font-extrabold" : undefined}
            badge={timeLow ? "CRITICAL" : undefined}
            badgeClass={timeLow ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" : undefined}
          />
        ) : isZen ? (
          <>
            <StatCard icon={Layers} label="Snippets" value={String(snippetsCompleted)} />
            <StatCard icon={Hash} label="Characters" value={String(totalChars)} />
          </>
        ) : (
          <StatCard icon={Clock} label="Elapsed" value={`${elapsedSeconds.toFixed(1)}s`} />
        )}

        {hasGhost && (
          <div className="glass-card rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-1.5 min-w-0 transition-all duration-200 hover:border-purple-500/40 relative group">
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 truncate font-sans">
                <Ghost className="size-3.5 shrink-0" />
                <span>PB {ghostState?.targetWpm.toFixed(0)}</span>
              </span>

              {onToggleGhost && (
                <button
                  type="button"
                  onClick={onToggleGhost}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold transition-all flex items-center gap-1 cursor-pointer select-none shrink-0",
                    isGhostEnabled
                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25"
                      : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"
                  )}
                  title={isGhostEnabled ? "Ghost Pace: ON (Click to disable)" : "Ghost Pace: OFF (Click to enable)"}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isGhostEnabled ? "bg-purple-500 dark:bg-purple-400 animate-pulse" : "bg-muted-foreground/40"
                    )}
                  />
                  {isGhostEnabled ? "ON" : "OFF"}
                </button>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight transition-opacity duration-200",
                  !isGhostEnabled && "opacity-40",
                  (ghostState?.deltaWpm ?? 0) > 0
                    ? "text-emerald-500"
                    : (ghostState?.deltaWpm ?? 0) < 0
                    ? "text-rose-500"
                    : "text-muted-foreground"
                )}
              >
                {isGhostEnabled
                  ? (ghostState?.deltaWpm ?? 0) > 0
                    ? `+${ghostState?.deltaWpm.toFixed(1)}`
                    : `${ghostState?.deltaWpm.toFixed(1)}`
                  : "OFF"}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">wpm</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Line */}
      <div className="relative h-2 w-full rounded-full bg-secondary/80 overflow-hidden shadow-inner">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-150 ease-out bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]",
            progress === 0 && "opacity-0"
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
