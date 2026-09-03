import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Focus, Gauge, Timer } from "lucide-react";
import type { TestMode, TimedDuration } from "@/types";

interface ModeSelectorProps {
  mode: TestMode;
  duration: TimedDuration | null;
  onSelect: (mode: TestMode, duration: TimedDuration | null) => void;
  disabled: boolean;
  isRunningZen: boolean;
  onStopZen?: () => void;
}

const TIMED_OPTIONS: { label: string; duration: TimedDuration }[] = [
  { label: '15s', duration: 15 },
  { label: '30s', duration: 30 },
  { label: '60s', duration: 60 },
  { label: '120s', duration: 120 },
];

export function ModeSelector({ mode, duration, onSelect, disabled, isRunningZen, onStopZen }: ModeSelectorProps) {
  const timedValue = mode === 'timed' ? `timed-${duration}` : mode;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Gauge aria-hidden="true" className="size-3" /> Mode
      </span>
      <ToggleGroup
        type="single"
        value={timedValue}
        onValueChange={(v) => {
          if (!v) return;
          if (v === 'snippet') onSelect('snippet', null);
          else if (v === 'zen') onSelect('zen', null);
          else if (v.startsWith('timed-')) {
            const d = Number(v.replace('timed-', '')) as TimedDuration;
            onSelect('timed', d);
          }
        }}
        disabled={disabled && !isRunningZen}
        className="flex-wrap justify-start gap-1.5"
      >
        <ToggleGroupItem value="snippet" className="btn-3d h-9 px-4 text-xs font-bold rounded-lg transition-all duration-150 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <Focus aria-hidden="true" />
          Snippet
        </ToggleGroupItem>
        {TIMED_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.duration}
            value={`timed-${opt.duration}`}
            className="btn-3d h-9 px-4 text-xs font-bold rounded-lg transition-all duration-150 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Timer aria-hidden="true" />
            {opt.label}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="zen" className="btn-3d h-9 px-4 text-xs font-bold rounded-lg transition-all duration-150 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <Focus aria-hidden="true" />
          Zen
        </ToggleGroupItem>
      </ToggleGroup>
      {isRunningZen && onStopZen && (
        <button
          onClick={onStopZen}
          className="text-xs text-destructive hover:underline mt-1"
        >
          Stop zen run
        </button>
      )}
    </div>
  );
}
