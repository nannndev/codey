import { Focus, Gauge, Timer, Sparkles } from "lucide-react";
import type { TestMode, TimedDuration } from "@/types";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  mode: TestMode;
  duration: TimedDuration | null;
  onSelect: (mode: TestMode, duration: TimedDuration | null) => void;
  disabled: boolean;
  isRunningZen: boolean;
  onStopZen?: () => void;
}

const TIMED_OPTIONS: { label: string; duration: TimedDuration }[] = [
  { label: "15s", duration: 15 },
  { label: "30s", duration: 30 },
  { label: "60s", duration: 60 },
  { label: "120s", duration: 120 },
];

export function ModeSelector({
  mode,
  duration,
  onSelect,
  disabled,
  isRunningZen,
  onStopZen,
}: ModeSelectorProps) {
  const currentTimedValue = mode === "timed" ? duration : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
          <Gauge aria-hidden="true" className="size-3.5 opacity-70" /> Practice Mode
        </span>

        {isRunningZen && onStopZen && (
          <button
            type="button"
            onClick={onStopZen}
            className="text-xs font-semibold text-rose-500 hover:text-rose-400 underline underline-offset-4 animate-pulse transition-colors"
          >
            End Zen Session (Tab)
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 glass-card rounded-xl p-1.5">
        {/* Snippet Mode */}
        <button
          type="button"
          disabled={disabled && !isRunningZen}
          onClick={() => onSelect("snippet", null)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none",
            mode === "snippet"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            disabled && !isRunningZen && "opacity-50 pointer-events-none"
          )}
        >
          <Focus className="size-3.5" />
          <span>Snippet</span>
        </button>

        {/* Timed Durations */}
        {TIMED_OPTIONS.map((opt) => {
          const isSelected = mode === "timed" && currentTimedValue === opt.duration;
          return (
            <button
              key={opt.duration}
              type="button"
              disabled={disabled && !isRunningZen}
              onClick={() => onSelect("timed", opt.duration)}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none font-mono",
                isSelected
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                disabled && !isRunningZen && "opacity-50 pointer-events-none"
              )}
            >
              <Timer className="size-3.5 font-sans" />
              <span>{opt.label}</span>
            </button>
          );
        })}

        {/* Zen Mode */}
        <button
          type="button"
          disabled={disabled && !isRunningZen}
          onClick={() => onSelect("zen", null)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none ml-auto",
            mode === "zen"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            disabled && !isRunningZen && "opacity-50 pointer-events-none"
          )}
        >
          <Sparkles className="size-3.5" />
          <span>Zen</span>
        </button>
      </div>
    </div>
  );
}
