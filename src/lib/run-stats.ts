/** Pure helpers behind the stats and profile charts. Timestamps are ms since epoch. */

export interface RunLike {
  timestamp: number;
  wpm: number;
  accuracy: number;
  language: string;
  mode: string;
  /** Milliseconds typed; used for practice time. */
  duration: number;
}

const DAY_MS = 86_400_000;

export const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/** Trailing mean over `window` runs (fewer at the start). */
export function rollingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => average(values.slice(Math.max(0, index - window + 1), index + 1)));
}

/** Local calendar day key, YYYY-MM-DD. */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export interface DayBucket {
  key: string;
  start: number;
  runs: number;
  minutes: number;
  bestWpm: number;
}

/** One bucket per calendar day for the `days` days ending today (inclusive). */
export function dailyBuckets(runs: RunLike[], days: number, now = Date.now()): DayBucket[] {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, index) => {
    // Step by calendar day, not 24h, so DST changes do not skip or repeat a day.
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - index));
    return { key: dayKey(date.getTime()), start: date.getTime(), runs: 0, minutes: 0, bestWpm: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const run of runs) {
    const bucket = byKey.get(dayKey(run.timestamp));
    if (!bucket) continue;
    bucket.runs += 1;
    bucket.minutes += run.duration / 60_000;
    bucket.bestWpm = Math.max(bucket.bestWpm, run.wpm);
  }
  return buckets;
}

export interface LanguageSummary {
  language: string;
  runs: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
}

export function languageSummary(runs: RunLike[]): LanguageSummary[] {
  const groups = new Map<string, RunLike[]>();
  for (const run of runs) groups.set(run.language, [...(groups.get(run.language) ?? []), run]);
  return [...groups.entries()]
    .map(([language, list]) => ({
      language,
      runs: list.length,
      avgWpm: average(list.map((run) => run.wpm)),
      bestWpm: Math.max(...list.map((run) => run.wpm)),
      avgAccuracy: average(list.map((run) => run.accuracy)),
    }))
    .sort((a, b) => b.runs - a.runs || b.avgWpm - a.avgWpm);
}

/** Consecutive days with at least one run, ending today or yesterday. */
export function streakFromRuns(runs: RunLike[], now = Date.now()): { current: number; best: number } {
  const days = new Set(runs.map((run) => dayKey(run.timestamp)));
  let best = 0;
  let run = 0;
  const sorted = [...days].sort();
  let previous: number | null = null;
  for (const key of sorted) {
    const start = new Date(`${key}T00:00:00`).getTime();
    run = previous !== null && Math.round((start - previous) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = start;
  }
  let current = 0;
  const cursor = new Date(startOfDay(now));
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.getTime()))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

/**
 * Compares the latest `size` runs with the `size` before them, so a stat can
 * say whether you are trending up. Null when there is not enough history.
 */
export function recentDelta(values: number[], size: number): number | null {
  if (values.length < size * 2) return null;
  const latest = average(values.slice(-size));
  const before = average(values.slice(-size * 2, -size));
  return latest - before;
}

/** Clean axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
export const formatShortDate = (timestamp: number) => shortDate.format(timestamp);

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
export function formatRelative(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(now)) / DAY_MS);
  if (days === 0) {
    const minutes = Math.round((timestamp - now) / 60_000);
    return Math.abs(minutes) < 60 ? relative.format(minutes, "minute") : relative.format(Math.round(minutes / 60), "hour");
  }
  if (Math.abs(days) < 7) return relative.format(days, "day");
  return formatShortDate(timestamp);
}
