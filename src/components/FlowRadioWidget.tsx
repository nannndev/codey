import { useState, useRef, useEffect } from "react";
import {
  CloudRain,
  Headphones,
  Pause,
  Play,
  Sliders,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useFlowRadio } from "./RadioProvider";
import { RADIO_STATIONS } from "@/utils/flow-radio-engine";
import { cn } from "@/lib/utils";

export function FlowRadioWidget() {
  const {
    isPlaying,
    station,
    stationInfo,
    volume,
    rainMix,
    rainEnabled,
    togglePlay,
    setStation,
    setVolume,
    setRainMix,
    toggleRain,
  } = useFlowRadio();

  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [expanded]);

  return (
    <aside
      ref={containerRef}
      aria-label="Flow State Radio Player"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end pointer-events-auto select-none"
    >
      {/* Expanded Control Flyout */}
      {expanded && (
        <div className="mb-2 w-72 sm:w-80 glass-card rounded-2xl p-4 shadow-2xl border border-border/80 animate-fade-in-up space-y-3.5 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <Headphones className="size-4 text-amber-500" />
              <div>
                <h4 className="text-xs font-bold text-foreground font-sans tracking-tight">Flow State Radio</h4>
                <p className="text-[10px] text-muted-foreground font-sans">Ambient focus beats & soundscapes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="grid size-6 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close Radio Menu"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Station Selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 font-mono">
              Ambient Stations
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {RADIO_STATIONS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStation(st.id)}
                  className={cn(
                    "flex flex-col items-start p-2 rounded-xl border text-left transition-all cursor-pointer",
                    station === st.id
                      ? "border-amber-500/80 bg-amber-500/15 shadow-xs"
                      : "border-border/60 bg-card/40 hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{st.icon}</span>
                    <span className="text-xs font-bold text-foreground font-sans truncate">{st.name}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono mt-0.5">{st.genre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Master Volume */}
          <div className="space-y-1.5 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground font-medium">
                {volume === 0 ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                Music Volume
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-foreground">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-amber-500"
              aria-label="Music volume"
            />
          </div>

          {/* Rain & Vinyl Texture Mix */}
          <div className="space-y-1.5 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={toggleRain}
                className={cn(
                  "flex items-center gap-1 font-medium transition-colors cursor-pointer",
                  rainEnabled ? "text-cyan-400" : "text-muted-foreground line-through opacity-70"
                )}
              >
                <CloudRain className="size-3.5" />
                Rain & Vinyl Atmosphere
              </button>
              <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                {rainEnabled ? `${rainMix}%` : "Muted"}
              </span>
            </div>
            {rainEnabled && (
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={rainMix}
                onChange={(e) => setRainMix(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-cyan-400"
                aria-label="Rain atmosphere mix volume"
              />
            )}
          </div>

          {/* Status Note */}
          <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[9px] text-muted-foreground leading-tight font-sans">
            💡 Harmonizes with mechanical switch clicks for undisturbed deep focus.
          </div>
        </div>
      )}

      {/* Collapsed Glass Dock Pill */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl glass-card px-3 py-2 shadow-xl border border-border/70 backdrop-blur-md transition-all duration-200",
          isPlaying ? "border-amber-500/40 shadow-[0_4px_20px_rgba(245,158,11,0.15)]" : "hover:border-foreground/30"
        )}
      >
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "grid size-7 place-items-center rounded-xl transition-all cursor-pointer",
            isPlaying
              ? "bg-amber-500 text-zinc-950 shadow-xs hover:bg-amber-400"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
          aria-label={isPlaying ? "Pause Flow Radio" : "Play Flow Radio"}
          title={isPlaying ? "Pause Flow Radio" : "Play Flow Radio"}
        >
          {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current translate-x-0.5" />}
        </button>

        {/* Animated Equalizer Waveform */}
        <div className="flex items-end gap-0.5 h-4 w-4.5 px-0.5 justify-center">
          <span
            className={cn(
              "w-0.5 rounded-full bg-amber-400 transition-all duration-300",
              isPlaying ? "h-3 animate-pulse" : "h-1"
            )}
            style={{ animationDuration: "600ms" }}
          />
          <span
            className={cn(
              "w-0.5 rounded-full bg-amber-500 transition-all duration-300",
              isPlaying ? "h-4 animate-pulse" : "h-1.5"
            )}
            style={{ animationDuration: "400ms", animationDelay: "150ms" }}
          />
          <span
            className={cn(
              "w-0.5 rounded-full bg-amber-400 transition-all duration-300",
              isPlaying ? "h-2.5 animate-pulse" : "h-1"
            )}
            style={{ animationDuration: "750ms", animationDelay: "300ms" }}
          />
        </div>

        {/* Current Station Title */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-col text-left cursor-pointer pr-1"
          title="Click to open Flow Radio menu"
        >
          <span className="text-[11px] font-bold text-foreground font-sans leading-none flex items-center gap-1">
            <span>{stationInfo.icon}</span>
            <span className="truncate max-w-[90px] sm:max-w-[120px]">{stationInfo.name}</span>
          </span>
          <span className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-none">
            {isPlaying ? "Live · Flowing" : "Station Paused"}
          </span>
        </button>

        {/* Expand/Collapse Toggle Button */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="grid size-6 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-l border-border/40 pl-1"
          aria-label={expanded ? "Collapse radio player" : "Expand radio player"}
          title={expanded ? "Collapse menu" : "Open stations & volume"}
        >
          <Sliders className="size-3 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
