import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Brain,
  ChevronDown,
  CloudRain,
  Coffee,
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sunset,
  Timer,
  Volume1,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { useFlowRadio } from "./RadioProvider";
import { RADIO_STATIONS, type RadioStation } from "@/utils/flow-radio-engine";
import { cn } from "@/lib/utils";

const STATION_ICONS: Record<RadioStation, ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  lofi: Coffee,
  synthwave: Sunset,
  rain: CloudRain,
  drone: Brain,
  noise: Waves,
};

const TIMERS = [25, 50, 90];

/** Frequency bars drawn straight from the radio's analyser; flat while paused. */
function Visualizer({ bars, color, active, className }: { bars: number; color: string; active: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getAnalyser } = useFlowRadio();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const levels = new Float32Array(bars);
    let frame = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const analyser = active ? getAnalyser() : null;
      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
      }
      const gap = Math.max(1, width / bars / 4);
      const barWidth = (width - gap * (bars - 1)) / bars;
      for (let index = 0; index < bars; index += 1) {
        // Bars spread on a log scale from 60 Hz to 8 kHz, like a real equaliser.
        const frequency = 60 * (8000 / 60) ** (index / Math.max(1, bars - 1));
        const bin = data && analyser ? Math.min(data.length - 1, Math.round(frequency / (analyser.context.sampleRate / analyser.fftSize))) : 0;
        const target = data ? (data[bin] / 255) ** 1.5 : 0;
        levels[index] += (target - levels[index]) * (reduceMotion ? 1 : 0.35);
        const barHeight = Math.max(2, levels[index] * height);
        context.fillStyle = color;
        context.globalAlpha = 0.45 + levels[index] * 0.55;
        const x = index * (barWidth + gap);
        context.beginPath();
        context.roundRect(x, height - barHeight, barWidth, barHeight, Math.min(barWidth / 2, 2));
        context.fill();
      }
      context.globalAlpha = 1;
      if (active && !reduceMotion) frame = requestAnimationFrame(draw);
    };
    draw();
    const interval = active && reduceMotion ? window.setInterval(draw, 500) : 0;
    return () => {
      cancelAnimationFrame(frame);
      if (interval) window.clearInterval(interval);
    };
  }, [active, bars, color, getAnalyser]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

function Slider({ value, onChange, label, accent, disabled }: { value: number; onChange: (value: number) => void; label: string; accent: string; disabled?: boolean }) {
  return (
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
      className="radio-slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      style={{ ["--fill" as string]: `${value}%`, ["--accent" as string]: accent }}
    />
  );
}

export function FlowRadioWidget() {
  const radio = useFlowRadio();
  const { isPlaying, station, stationInfo, volume, rainMix, rainEnabled, timerEndsAt } = radio;
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const countdown = useCountdown(timerEndsAt);
  const accent = stationInfo.accent;
  const StationIcon = STATION_ICONS[station];
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  useEffect(() => {
    if (!expanded) return;
    const onPointer = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setExpanded(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  return (
    <aside ref={containerRef} aria-label="Flow Radio" className="fixed bottom-4 right-4 z-40 flex select-none flex-col items-end">
      {expanded && (
        <div role="dialog" aria-label="Flow Radio player" className="mb-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl animate-fade-in-up">
          {/* Now playing */}
          <div className="relative overflow-hidden px-4 pb-4 pt-3.5" style={{ background: `linear-gradient(160deg, ${accent}33, transparent 70%)` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl shadow-sm" style={{ background: accent }}>
                  <StationIcon className="size-5 text-zinc-950" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isPlaying ? "Now playing" : "Flow Radio"}</p>
                  <p className="truncate text-sm font-black tracking-tight">{stationInfo.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{stationInfo.genre}</p>
                </div>
              </div>
              <button type="button" onClick={() => setExpanded(false)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close player">
                <X className="size-4" />
              </button>
            </div>
            <Visualizer bars={28} color={accent} active={isPlaying} className="mt-3 h-12 w-full" />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {stationInfo.description}
              {stationInfo.headphones && <span className="ml-1 inline-flex items-center gap-1 font-semibold text-foreground"><Headphones className="size-3" /> Best on headphones.</span>}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button type="button" onClick={radio.previousStation} className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Previous station">
                <SkipBack className="size-4 fill-current" />
              </button>
              <button
                type="button"
                onClick={radio.togglePlay}
                className="grid size-12 place-items-center rounded-full text-zinc-950 shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ background: accent, boxShadow: `0 8px 24px ${accent}55` }}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-0.5 fill-current" />}
              </button>
              <button type="button" onClick={radio.nextStation} className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Next station">
                <SkipForward className="size-4 fill-current" />
              </button>
            </div>
          </div>

          {/* Stations */}
          <ul className="space-y-0.5 border-t px-2 py-2" aria-label="Stations">
            {RADIO_STATIONS.map((item) => {
              const Icon = STATION_ICONS[item.id];
              const active = item.id === station;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => (active && !isPlaying ? radio.togglePlay() : radio.setStation(item.id))}
                    aria-pressed={active}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors", active ? "bg-muted" : "hover:bg-muted/60")}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: active ? item.accent : `${item.accent}22` }}>
                      <Icon className={cn("size-3.5", active ? "text-zinc-950" : "")} style={active ? undefined : { color: item.accent }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{item.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{item.genre}</span>
                    </span>
                    {item.headphones && <Headphones className="size-3.5 shrink-0 text-muted-foreground" aria-label="Best on headphones" />}
                    {active && isPlaying && <Visualizer bars={3} color={item.accent} active className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Mixer */}
          <div className="space-y-3 border-t px-4 py-3">
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => radio.setVolume(volume === 0 ? 50 : 0)} className="text-muted-foreground transition-colors hover:text-foreground" aria-label={volume === 0 ? "Unmute" : "Mute"}>
                <VolumeIcon className="size-4" />
              </button>
              <Slider value={volume} onChange={radio.setVolume} label="Music volume" accent={accent} />
              <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{volume}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={radio.toggleRain}
                aria-pressed={rainEnabled}
                className={cn("transition-colors", rainEnabled ? "text-sky-400" : "text-muted-foreground hover:text-foreground")}
                aria-label={rainEnabled ? "Turn rain off" : "Add rain"}
                title="Rain on top of any station"
              >
                <CloudRain className="size-4" />
              </button>
              <Slider value={rainEnabled ? rainMix : 0} onChange={radio.setRainMix} label="Rain level" accent="#38bdf8" />
              <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{rainEnabled ? rainMix : "off"}</span>
            </div>
          </div>

          {/* Focus timer */}
          <div className="flex items-center gap-2 border-t px-4 py-2.5">
            <Timer className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-semibold">Focus timer</span>
            <div className="ml-auto flex items-center gap-1">
              {countdown ? (
                <>
                  <span className="font-mono text-xs font-bold tabular-nums" style={{ color: accent }}>{countdown}</span>
                  <button type="button" onClick={() => radio.setTimer(null)} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
                </>
              ) : (
                TIMERS.map((minutes) => (
                  <button key={minutes} type="button" onClick={() => radio.setTimer(minutes)} className="rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground" title={`Play for ${minutes} minutes, then fade out`}>
                    {minutes}m
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isPlaying || expanded ? (
        <div
          className="flex items-center gap-2 rounded-2xl border bg-popover/90 py-1.5 pl-1.5 pr-1 text-popover-foreground shadow-xl backdrop-blur-md transition-colors"
          style={isPlaying ? { borderColor: `${accent}66`, boxShadow: `0 6px 24px ${accent}26` } : undefined}
        >
          <button
            type="button"
            onClick={radio.togglePlay}
            className="grid size-8 place-items-center rounded-xl text-zinc-950 transition-transform active:scale-95"
            style={{ background: accent }}
            aria-label={isPlaying ? "Pause Flow Radio" : "Play Flow Radio"}
          >
            {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 translate-x-px fill-current" />}
          </button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-0 items-center gap-2 rounded-lg py-0.5 pr-1 text-left" aria-expanded={expanded} aria-label="Open Flow Radio">
            <Visualizer bars={5} color={accent} active={isPlaying} className="h-5 w-6 shrink-0" />
            <span className="min-w-0">
              <span className="block max-w-32 truncate text-[11px] font-bold leading-tight">{stationInfo.name}</span>
              <span className="block text-[10px] leading-tight text-muted-foreground">{countdown ? `Focus · ${countdown}` : isPlaying ? stationInfo.genre.split(" · ")[0] : "Paused"}</span>
            </span>
            <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !expanded && "rotate-180")} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group flex size-10 items-center justify-center rounded-full border bg-popover/90 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:w-auto hover:gap-2 hover:px-3 hover:text-foreground"
          aria-label="Open Flow Radio"
          title="Flow Radio"
        >
          <Headphones className="size-4 shrink-0" />
          <span className="hidden text-xs font-semibold group-hover:inline">Flow Radio</span>
        </button>
      )}
    </aside>
  );
}
