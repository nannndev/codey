/**
 * A run's speed over time, stored on the cloud run as a short comma-separated
 * list ("72,88,95") and drawn as bars on the share card. Shared by the client
 * (practice runs) and the Ranked server (verified runs), so no path aliases.
 */

export const TRACE_BARS = 16;
const MAX_WPM = 400;

/** Averages `values` into at most `bars` evenly sized groups. */
export function bucketTrace(values: number[], bars = TRACE_BARS): number[] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length <= bars) return clean.map((value) => Math.round(value));
  const out: number[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const start = Math.floor((bar * clean.length) / bars);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * clean.length) / bars));
    const slice = clean.slice(start, end);
    out.push(Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length));
  }
  return out;
}

/**
 * From the per-second running average WPM the typing screen records: the
 * speed within each second, so the bars show the pace rather than the average.
 */
export function traceFromSnapshots(snapshots: number[]): number[] {
  const perSecond = snapshots.map((wpm, index) => {
    const previous = index === 0 ? 0 : snapshots[index - 1] * index;
    return Math.max(0, wpm * (index + 1) - previous);
  });
  return bucketTrace(perSecond);
}

/** From the gaps between keystrokes (ms): keys per time slice, as WPM. */
export function traceFromIntervals(intervals: number[], totalMs: number): number[] {
  if (intervals.length < TRACE_BARS || totalMs <= 0) return [];
  const slice = totalMs / TRACE_BARS;
  const counts = new Array<number>(TRACE_BARS).fill(0);
  let at = 0;
  for (const gap of intervals) {
    at += Math.max(0, gap);
    // A key landing exactly on a boundary closes the slice before it.
    counts[Math.max(0, Math.min(TRACE_BARS - 1, Math.ceil(at / slice) - 1))] += 1;
  }
  return counts.map((count) => Math.round(count / 5 / (slice / 60_000)));
}

export function encodeTrace(trace: number[]): string | undefined {
  const values = trace.filter((value) => Number.isFinite(value)).map((value) => Math.max(0, Math.min(MAX_WPM, Math.round(value))));
  return values.length >= 3 ? values.join(",") : undefined;
}

export function parseTrace(value: unknown): number[] {
  if (typeof value !== "string" || !value) return [];
  const values = value.split(",").slice(0, TRACE_BARS * 2).map(Number);
  return values.every((item) => Number.isFinite(item) && item >= 0 && item <= MAX_WPM) && values.length >= 3 ? values : [];
}
