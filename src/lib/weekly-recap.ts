import { average, languageSummary, type RunLike } from "./run-stats";

/** This week against last week (Monday to Sunday, local time). */

export interface WeekTotals {
  runs: number;
  minutes: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  /** Days with at least one run. */
  days: number;
  topLanguage: string | null;
  /** Runs per day, Monday first. */
  perDay: number[];
}

export interface WeeklyRecap {
  /** Monday of this week, local midnight. */
  weekStart: number;
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  /** Average WPM change against last week; null without runs in both. */
  wpmDelta: number | null;
  accuracyDelta: number | null;
}

const DAY = 86_400_000;

export function startOfWeek(now: number) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

function totals(runs: RunLike[], start: number): WeekTotals {
  const inWeek = runs.filter((run) => run.timestamp >= start && run.timestamp < start + 7 * DAY);
  const perDay = new Array<number>(7).fill(0);
  for (const run of inWeek) {
    const index = Math.min(6, Math.floor((new Date(run.timestamp).setHours(0, 0, 0, 0) - start) / DAY + 0.01));
    perDay[Math.max(0, index)] += 1;
  }
  return {
    runs: inWeek.length,
    minutes: inWeek.reduce((sum, run) => sum + run.duration / 60_000, 0),
    avgWpm: average(inWeek.map((run) => run.wpm)),
    bestWpm: inWeek.reduce((best, run) => Math.max(best, run.wpm), 0),
    avgAccuracy: average(inWeek.map((run) => run.accuracy)),
    days: perDay.filter(Boolean).length,
    topLanguage: languageSummary(inWeek)[0]?.language ?? null,
    perDay,
  };
}

export function weeklyRecap(runs: RunLike[], now = Date.now()): WeeklyRecap {
  const weekStart = startOfWeek(now);
  // Last week starts seven calendar days earlier (DST-safe via the date).
  const previous = new Date(weekStart);
  previous.setDate(previous.getDate() - 7);
  const thisWeek = totals(runs, weekStart);
  const lastWeek = totals(runs, previous.getTime());
  const both = thisWeek.runs > 0 && lastWeek.runs > 0;
  return {
    weekStart,
    thisWeek,
    lastWeek,
    wpmDelta: both ? Math.round((thisWeek.avgWpm - lastWeek.avgWpm) * 10) / 10 : null,
    accuracyDelta: both ? Math.round((thisWeek.avgAccuracy - lastWeek.avgAccuracy) * 10) / 10 : null,
  };
}

/** A one-line summary, e.g. for a share caption. */
export function recapText(recap: WeeklyRecap) {
  const { thisWeek } = recap;
  if (!thisWeek.runs) return "No runs yet this week on Codey.";
  const delta = recap.wpmDelta === null ? "" : `, ${recap.wpmDelta >= 0 ? "+" : ""}${recap.wpmDelta.toFixed(1)} WPM on last week`;
  return `My week on Codey: ${thisWeek.runs} ${thisWeek.runs === 1 ? "run" : "runs"} over ${thisWeek.days} ${thisWeek.days === 1 ? "day" : "days"}, ${thisWeek.avgWpm.toFixed(1)} WPM average${delta}.`;
}
