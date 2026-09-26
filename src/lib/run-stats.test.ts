import { describe, expect, it } from "vitest";
import {
  average,
  dailyBuckets,
  dayKey,
  formatMinutes,
  languageSummary,
  niceTicks,
  recentDelta,
  rollingAverage,
  streakFromRuns,
  type RunLike,
} from "./run-stats";

const NOW = new Date(2026, 8, 26, 15, 0).getTime(); // Sat 26 Sep 2026, 15:00 local
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};
const run = (overrides: Partial<RunLike>): RunLike => ({
  timestamp: NOW,
  wpm: 60,
  accuracy: 95,
  language: "TypeScript",
  mode: "snippet",
  duration: 60_000,
  ...overrides,
});

describe("average and rollingAverage", () => {
  it("averages, and treats an empty list as zero", () => {
    expect(average([10, 20, 30])).toBe(20);
    expect(average([])).toBe(0);
  });

  it("uses fewer values at the start of the window", () => {
    expect(rollingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35]);
  });
});

describe("dailyBuckets", () => {
  it("returns one bucket per day ending today, oldest first", () => {
    const buckets = dailyBuckets([], 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].key).toBe(dayKey(NOW));
    expect(buckets[0].key).toBe(dayKey(daysAgo(6)));
  });

  it("counts runs, minutes and the best speed per day, and ignores older runs", () => {
    const buckets = dailyBuckets(
      [
        run({ timestamp: daysAgo(0, 9), wpm: 70, duration: 30_000 }),
        run({ timestamp: daysAgo(0, 18), wpm: 80, duration: 90_000 }),
        run({ timestamp: daysAgo(2) }),
        run({ timestamp: daysAgo(30) }),
      ],
      7,
      NOW
    );
    const today = buckets[6];
    expect(today).toMatchObject({ runs: 2, bestWpm: 80 });
    expect(today.minutes).toBeCloseTo(2);
    expect(buckets[4].runs).toBe(1);
    expect(buckets.reduce((sum, bucket) => sum + bucket.runs, 0)).toBe(3);
  });

  it("keeps calendar days distinct across a daylight-saving change", () => {
    const keys = dailyBuckets([], 400, NOW).map((bucket) => bucket.key);
    expect(new Set(keys).size).toBe(400);
  });
});

describe("languageSummary", () => {
  it("groups by language, most practiced first", () => {
    const summary = languageSummary([
      run({ language: "Go", wpm: 50 }),
      run({ language: "Rust", wpm: 40 }),
      run({ language: "Rust", wpm: 60, accuracy: 90 }),
    ]);
    expect(summary.map((item) => item.language)).toEqual(["Rust", "Go"]);
    expect(summary[0]).toMatchObject({ runs: 2, avgWpm: 50, bestWpm: 60, avgAccuracy: 92.5 });
  });
});

describe("streakFromRuns", () => {
  it("counts consecutive days ending today", () => {
    const runs = [0, 1, 2, 5, 6, 7, 8].map((days) => run({ timestamp: daysAgo(days) }));
    expect(streakFromRuns(runs, NOW)).toEqual({ current: 3, best: 4 });
  });

  it("keeps a streak alive until the end of the next day", () => {
    const runs = [1, 2].map((days) => run({ timestamp: daysAgo(days) }));
    expect(streakFromRuns(runs, NOW).current).toBe(2);
  });

  it("is zero once a full day is missed", () => {
    expect(streakFromRuns([run({ timestamp: daysAgo(2) })], NOW).current).toBe(0);
  });

  it("counts several runs on one day once", () => {
    const runs = [run({ timestamp: daysAgo(0, 8) }), run({ timestamp: daysAgo(0, 20) })];
    expect(streakFromRuns(runs, NOW)).toEqual({ current: 1, best: 1 });
  });
});

describe("recentDelta", () => {
  it("compares the latest window with the one before it", () => {
    expect(recentDelta([10, 10, 20, 20], 2)).toBe(10);
  });

  it("needs two full windows", () => {
    expect(recentDelta([10, 20, 30], 2)).toBeNull();
  });
});

describe("niceTicks", () => {
  it("covers the range with round steps", () => {
    const ticks = niceTicks(43, 87, 4);
    expect(ticks[0]).toBeLessThanOrEqual(43);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(87);
    const steps = new Set(ticks.slice(1).map((tick, index) => tick - ticks[index]));
    expect(steps.size).toBe(1);
    expect([5, 10, 20, 25]).toContain([...steps][0]);
  });

  it("does not loop or divide by zero on a flat range", () => {
    expect(niceTicks(50, 50).length).toBeGreaterThan(1);
  });
});

describe("formatMinutes", () => {
  it("picks the unit by size", () => {
    expect(formatMinutes(0.5)).toBe("30s");
    expect(formatMinutes(25)).toBe("25m");
    expect(formatMinutes(125)).toBe("2h 5m");
    expect(formatMinutes(120)).toBe("2h");
  });
});
