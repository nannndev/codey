import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate, niceTicks, rollingAverage, type DayBucket, type LanguageSummary } from "@/lib/run-stats";

/** Chart hues: marks only. Text always uses the text tokens. */
export const SPEED_COLOR = "var(--chart-speed)";
export const ACCURACY_COLOR = "var(--chart-accuracy)";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface TrendPoint {
  t: number;
  value: number;
  /** Shown under the value in the tooltip, e.g. "TypeScript · snippet". */
  detail?: string;
}

/**
 * Line chart for a per-run measure: faint dots for each run, a 2px trailing
 * average, the best run called out, and a crosshair tooltip that snaps to runs.
 */
export function TrendChart({ points, color, unit, label, averageWindow = 5, domain, height = 220, format = (value) => value.toFixed(1), emptyText = "Finish a few runs to see your trend." }: {
  points: TrendPoint[];
  color: string;
  unit: string;
  /** Names the measure for screen readers and the tooltip, e.g. "WPM". */
  label: string;
  averageWindow?: number;
  domain?: [number, number];
  height?: number;
  format?: (value: number) => string;
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((point) => point.value);
  const averages = rollingAverage(values, averageWindow);

  if (points.length < 2) {
    return <div className="grid place-items-center rounded-xl border border-dashed text-sm text-muted-foreground" style={{ height }}>{emptyText}</div>;
  }

  const pad = { top: 16, right: 16, bottom: 26, left: 40 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const lo = domain?.[0] ?? Math.max(0, Math.min(...values) - 5);
  const hi = domain?.[1] ?? Math.max(...values) + 5;
  const ticks = niceTicks(lo, hi, 4).filter((tick) => tick >= lo - 0.001 && tick <= Math.max(hi, lo + 1) + 0.001);
  const yMin = Math.min(lo, ticks[0] ?? lo);
  const yMax = Math.max(hi, ticks[ticks.length - 1] ?? hi);
  const x = (index: number) => pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => pad.top + innerH - ((value - yMin) / (yMax - yMin || 1)) * innerH;
  const bestIndex = values.indexOf(Math.max(...values));
  const line = averages.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)},${pad.top + innerH}L${x(0).toFixed(1)},${pad.top + innerH}Z`;
  const dateTicks = Array.from(new Set([0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1]));

  const pick = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left - pad.left) / innerW;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((current) => Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
  };

  const activePoint = active !== null ? points[active] : null;
  const tipLeft = active !== null ? x(active) : 0;

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label} over your last ${points.length} runs, from ${format(values[0])} to ${format(values[values.length - 1])} ${unit}. Best ${format(values[bestIndex])} ${unit}.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((current) => current ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-lg"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(tick)} y2={y(tick)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground font-mono text-[10px] tabular-nums">{tick}</text>
            </g>
          ))}
          {dateTicks.map((index) => (
            <text key={index} x={x(index)} y={height - 6} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">
              {formatShortDate(points[index].t)}
            </text>
          ))}
          <path d={area} fill={color} opacity={0.1} />
          {points.map((point, index) => (
            <circle key={index} cx={x(index)} cy={y(point.value)} r={2.5} fill={color} opacity={0.35} />
          ))}
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(bestIndex)} cy={y(values[bestIndex])} r={4.5} fill={color} stroke="var(--color-card-solid)" strokeWidth={2} />
          <text
            x={x(bestIndex)}
            y={y(values[bestIndex]) - 10}
            textAnchor={bestIndex > points.length * 0.85 ? "end" : bestIndex < points.length * 0.15 ? "start" : "middle"}
            className="fill-foreground text-[10px] font-bold"
          >
            Best {format(values[bestIndex])}
          </text>
          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke="var(--color-muted-foreground)" strokeWidth={1} opacity={0.5} />
              <circle cx={x(active)} cy={y(points[active].value)} r={4.5} fill={color} stroke="var(--color-card-solid)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {activePoint && active !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: tipLeft, translate: tipLeft > width * 0.6 ? "calc(-100% - 12px) 0" : "12px 0" }}
        >
          <p className="font-mono text-base font-black tabular-nums">{format(activePoint.value)} <span className="text-xs font-semibold text-muted-foreground">{unit}</span></p>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
            {averageWindow}-run avg {format(averages[active])}
          </p>
          <p className="mt-1 text-muted-foreground">{formatShortDate(activePoint.t)}{activePoint.detail ? ` · ${activePoint.detail}` : ""}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{label} per run</caption>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}><td>{formatShortDate(point.t)}</td><td>{format(point.value)} {unit}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendLegend({ color, averageWindow = 5 }: { color: string; averageWindow?: number }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full opacity-50" style={{ background: color }} /> Each run</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded" style={{ background: color }} /> {averageWindow}-run average</span>
    </div>
  );
}

/** Columns per day with a hover readout; the busiest day is labeled. */
export function DailyBars({ days, height = 160, metric = "runs" }: { days: DayBucket[]; height?: number; metric?: "runs" | "minutes" }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const value = (day: DayBucket) => (metric === "runs" ? day.runs : day.minutes);
  const max = Math.max(1, ...days.map(value));
  const pad = { top: 18, bottom: 22 };
  const innerH = height - pad.top - pad.bottom;
  const band = width / Math.max(1, days.length);
  const barW = Math.min(24, Math.max(4, band - 6));
  const busiest = days.reduce((best, day, index) => (value(day) > value(days[best]) ? index : best), 0);
  const labelEvery = days.length > 16 ? 7 : days.length > 8 ? 2 : 1;
  const describe = (day: DayBucket) =>
    `${formatShortDate(day.start)}: ${day.runs} ${day.runs === 1 ? "run" : "runs"}${day.minutes ? `, ${Math.round(day.minutes)} min` : ""}${day.bestWpm ? `, best ${day.bestWpm.toFixed(0)} wpm` : ""}`;

  return (
    <div ref={ref} className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Runs per day for the last ${days.length} days`}>
          <line x1={0} x2={width} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--color-border)" />
          {days.map((day, index) => {
            const h = (value(day) / max) * innerH;
            const cx = band * index + band / 2;
            const top = pad.top + innerH - h;
            return (
              <g key={day.key} onPointerEnter={() => setActive(index)}>
                <rect x={band * index} y={0} width={band} height={height} fill="transparent" />
                {h > 0 ? (
                  <path
                    d={`M${cx - barW / 2},${pad.top + innerH}V${top + Math.min(4, h)}q0,-${Math.min(4, h)} ${Math.min(4, barW / 2)},-${Math.min(4, h)}H${cx + barW / 2 - Math.min(4, barW / 2)}q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)}V${pad.top + innerH}Z`}
                    fill={SPEED_COLOR}
                    opacity={active === null || active === index ? 1 : 0.45}
                  />
                ) : (
                  <rect x={cx - barW / 2} y={pad.top + innerH - 2} width={barW} height={2} rx={1} fill="var(--color-border)" />
                )}
                {index === busiest && value(day) > 0 && (
                  <text x={cx} y={top - 5} textAnchor="middle" className="fill-foreground font-mono text-[10px] font-bold">
                    {metric === "runs" ? day.runs : `${Math.round(day.minutes)}m`}
                  </text>
                )}
                {(index % labelEvery === (days.length - 1) % labelEvery) && (
                  <text x={cx} y={height - 6} textAnchor={index === days.length - 1 && days.length > 8 ? "end" : "middle"} dx={index === days.length - 1 && days.length > 8 ? barW / 2 : 0} className="fill-muted-foreground text-[10px]">
                    {days.length > 8 ? formatShortDate(day.start) : new Date(day.start).toLocaleDateString(undefined, { weekday: "short" })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: band * active + band / 2, translate: band * active > width * 0.6 ? "calc(-100% - 8px) 0" : "8px 0" }}
        >
          <p className="font-mono font-black tabular-nums">{days[active].runs} <span className="font-semibold text-muted-foreground">{days[active].runs === 1 ? "run" : "runs"}</span></p>
          <p className="text-muted-foreground">{formatShortDate(days[active].start)}{days[active].minutes ? ` · ${Math.round(days[active].minutes)} min` : ""}{days[active].bestWpm ? ` · best ${days[active].bestWpm.toFixed(0)}` : ""}</p>
        </div>
      )}
      <ul className="sr-only">{days.map((day) => <li key={day.key}>{describe(day)}</li>)}</ul>
    </div>
  );
}

/** GitHub-style year-ish grid: one cell per day, darker amber for more runs. */
export function ActivityCalendar({ days }: { days: DayBucket[] }) {
  const [active, setActive] = useState<DayBucket | null>(null);
  const max = Math.max(1, ...days.map((day) => day.runs));
  const level = (runs: number) => (runs === 0 ? 0 : Math.min(4, Math.ceil((runs / max) * 4)));
  // Pad the front so columns are whole weeks starting on Sunday.
  const lead = new Date(days[0]?.start ?? Date.now()).getDay();
  const cells: (DayBucket | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  const weeks: (DayBucket | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  // Label the week where each month starts, skipping labels that would crowd the previous one.
  let lastLabeled = -3;
  const months = weeks.map((week, index) => {
    const first = week.find(Boolean);
    if (!first) return null;
    const month = new Date(first.start).getMonth();
    const prev = weeks[index - 1]?.find(Boolean);
    const starts = !prev || new Date(prev.start).getMonth() !== month;
    if (!starts || index - lastLabeled < 3) return null;
    lastLabeled = index;
    return new Date(first.start).toLocaleDateString(undefined, { month: "short" });
  });
  const activeDays = days.filter((day) => day.runs > 0).length;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(10px, 1fr))`, minWidth: weeks.length * 13 }} onPointerLeave={() => setActive(null)}>
          {months.map((month, index) => (
            <span key={`m-${index}`} className="h-4 whitespace-nowrap text-[10px] text-muted-foreground">{month ?? ""}</span>
          ))}
          {Array.from({ length: 7 }, (_, row) =>
            weeks.map((week, col) => {
              const day = week[row];
              if (!day) return <span key={`${row}-${col}`} className="aspect-square" />;
              return (
                <button
                  key={day.key}
                  type="button"
                  aria-label={`${formatShortDate(day.start)}: ${day.runs} ${day.runs === 1 ? "run" : "runs"}`}
                  onPointerEnter={() => setActive(day)}
                  onFocus={() => setActive(day)}
                  className={cn("activity-cell aspect-square w-full max-w-5 rounded-[3px] outline-none ring-offset-1 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring", active?.key === day.key && "ring-2 ring-foreground/60")}
                  data-level={level(day.runs)}
                  style={{ gridColumn: col + 1, gridRow: row + 2 }}
                />
              );
            })
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span aria-live="polite">
          {active
            ? `${formatShortDate(active.start)} · ${active.runs} ${active.runs === 1 ? "run" : "runs"}${active.bestWpm ? ` · best ${active.bestWpm.toFixed(0)} wpm` : ""}${active.minutes ? ` · ${Math.round(active.minutes)} min` : ""}`
            : `${activeDays} active ${activeDays === 1 ? "day" : "days"} in the last ${Math.round(days.length / 7)} weeks`}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((value) => <span key={value} className="activity-cell size-2.5 rounded-[2px]" data-level={value} />)}
          More
        </span>
      </div>
    </div>
  );
}

/** Average speed per language, most practiced first. */
export function LanguageBars({ languages, limit = 6 }: { languages: LanguageSummary[]; limit?: number }) {
  const shown = languages.slice(0, limit);
  const max = Math.max(1, ...shown.map((item) => item.avgWpm));
  if (!shown.length) return <p className="py-6 text-center text-sm text-muted-foreground">No runs yet.</p>;
  return (
    <ul className="space-y-2.5">
      {shown.map((item) => (
        <li key={item.language} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate font-semibold">{item.language}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(item.avgWpm / max) * 100}%`, background: SPEED_COLOR }} />
          </span>
          <span className="w-28 text-right font-mono tabular-nums">
            <b>{item.avgWpm.toFixed(1)}</b> <span className="text-muted-foreground">wpm · {item.runs}×</span>
          </span>
        </li>
      ))}
      {languages.length > limit && <li className="text-[11px] text-muted-foreground">+{languages.length - limit} more</li>}
    </ul>
  );
}

/** A labeled number with an optional change vs the previous window. */
export function StatTile({ label, value, unit, sub, delta, deltaUnit = "", higherIsBetter = true, icon }: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  delta?: number | null;
  deltaUnit?: string;
  higherIsBetter?: boolean;
  icon?: ReactNode;
}) {
  const hasDelta = delta !== null && delta !== undefined && Math.abs(delta) >= 0.05;
  const good = hasDelta && (delta > 0) === higherIsBetter;
  return (
    <div className="rounded-2xl border bg-card/80 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
        {value}{unit && <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span>}
      </p>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        {hasDelta && (
          <span className={cn("inline-flex items-center gap-0.5 rounded px-1 font-semibold", good ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/12 text-rose-700 dark:text-rose-400")}>
            {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}{deltaUnit}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}
