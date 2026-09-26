import { Link } from "react-router-dom";
import { Check, Crown, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLAME_TIERS, streakMessage, type StreakStatus } from "@/lib/streak";
import { KapMascot } from "./KapMascot";

function FlameGlyph({ color, core, className }: { color: string; core: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 30" className={className} aria-hidden>
      <path d="M12 1 C 21 9, 22 19, 12 29 C 2 19, 3 12, 8.5 7 C 9 12, 12 10, 12 1 Z" fill={color} />
      <path d="M12 14 C 17 18, 16.5 24, 12 28.5 C 7.5 24, 7 18, 12 14 Z" fill={core} />
    </svg>
  );
}

/** Everything about the streak: Kap, this week, the next milestone and the flame ladder. */
export function StreakPanel({ status, onNavigate }: { status: StreakStatus; onNavigate?: () => void }) {
  const message = streakMessage(status);
  const accent = status.tier?.flame ?? "#a1a1aa";

  return (
    <div className="w-full sm:w-[22rem]">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-muted/70 to-transparent px-4 pb-3 pt-4 text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-4 size-36 -translate-x-1/2 rounded-full opacity-30 blur-2xl"
          style={{ background: status.mood === "sleep" ? "transparent" : accent }}
          aria-hidden
        />
        <KapMascot mood={status.mood} tier={status.tier} size={124} className="relative mx-auto" title={`Kap: ${message.title}`} />
        <p className="relative mt-1 text-base font-black tracking-tight">{message.title}</p>
        <p className="relative mx-auto mt-0.5 max-w-64 text-xs leading-relaxed text-muted-foreground">{message.body}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Current", `${status.current}`, status.current === 1 ? "day" : "days"],
          ["Best", `${status.best}`, status.best === 1 ? "day" : "days"],
          ["Flame", status.tier?.name ?? "None", status.mood === "risk" ? "fading" : status.mood === "sleep" ? "out" : "burning"],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-lg border bg-card/60 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate font-mono text-lg font-black tabular-nums leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border bg-card/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last 7 days</p>
        <ol className="mt-2 grid grid-cols-7 gap-1">
          {status.week.map((day) => (
            <li key={day.key} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2 transition-colors",
                  day.practiced ? "border-transparent text-white" : "border-dashed border-border text-muted-foreground",
                  day.today && !day.practiced && "border-solid border-amber-500/70",
                )}
                style={day.practiced ? { background: accent } : undefined}
                title={`${day.key}${day.practiced ? ": practiced" : ""}`}
              >
                {day.practiced ? <Check className="size-4" strokeWidth={3} /> : day.today ? <span className="size-1.5 rounded-full bg-amber-500" /> : null}
              </span>
              <span className={cn("text-[10px]", day.today ? "font-bold text-foreground" : "text-muted-foreground")}>{day.today ? "Today" : day.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 rounded-lg border bg-card/60 p-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold">Next milestone</span>
          <span className="font-mono tabular-nums text-muted-foreground">{status.current} / {status.nextMilestone} days</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, status.progress * 100)}%`, background: accent }} />
        </div>
        <ol className="mt-3 flex items-end justify-between gap-1">
          {FLAME_TIERS.map((tier) => {
            const reached = status.current >= tier.min;
            const isCurrent = status.tier?.id === tier.id;
            return (
              <li key={tier.id} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-md py-1", isCurrent && "bg-muted")} title={`${tier.name}: ${tier.min}+ days`}>
                <span className="relative">
                  <FlameGlyph color={reached ? tier.flame : "#71717a"} core={reached ? tier.core : "#a1a1aa"} className={cn("h-5 w-4", !reached && "opacity-40")} />
                  {tier.crown && <Crown className={cn("absolute -right-2 -top-1.5 size-3", reached ? "text-yellow-400" : "text-muted-foreground/50")} />}
                </span>
                <span className={cn("text-[9px] font-semibold", reached ? "text-foreground" : "text-muted-foreground")}>{tier.min}d</span>
              </li>
            );
          })}
        </ol>
      </div>

      {!status.practicedToday && (
        <Link
          to="/"
          onClick={onNavigate}
          className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-foreground text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Play className="size-3.5" /> {status.current > 0 ? "Practice to keep the streak" : "Start a streak"}
        </Link>
      )}
    </div>
  );
}
