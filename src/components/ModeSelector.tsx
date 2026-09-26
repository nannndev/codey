import { Focus, Sparkles } from "lucide-react";
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

  const item = (active: boolean) => cn(
    "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer select-none",
    active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
    disabled && !isRunningZen && "opacity-50 pointer-events-none",
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="Practice mode">
      <button type="button" disabled={disabled && !isRunningZen} onClick={() => onSelect("snippet", null)} className={item(mode === "snippet")}>
        <Focus className="size-3.5" />
        <span>Snippet</span>
      </button>
      {TIMED_OPTIONS.map((opt) => (
        <button
          key={opt.duration}
          type="button"
          disabled={disabled && !isRunningZen}
          onClick={() => onSelect("timed", opt.duration)}
          className={cn(item(mode === "timed" && currentTimedValue === opt.duration), "font-mono")}
          aria-label={`${opt.label} timed`}
        >
          {opt.label}
        </button>
      ))}
      <button type="button" disabled={disabled && !isRunningZen} onClick={() => onSelect("zen", null)} className={item(mode === "zen")}>
        <Sparkles className="size-3.5" />
        <span>Zen</span>
      </button>
      {isRunningZen && onStopZen && (
        <button
          type="button"
          onClick={onStopZen}
          className="ml-1 text-xs font-semibold text-rose-500 underline underline-offset-4 transition-colors hover:text-rose-400"
        >
          End Zen (Tab)
        </button>
      )}
    </div>
  );
}
