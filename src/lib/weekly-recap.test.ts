import { describe, expect, it } from "vitest";
import { recapText, startOfWeek, weeklyRecap } from "./weekly-recap";
import type { RunLike } from "./run-stats";

const NOW = new Date(2026, 8, 26, 18, 0).getTime(); // Saturday
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const run = (timestamp: number, wpm: number, language = "TypeScript"): RunLike => ({ timestamp, wpm, accuracy: 95, language, mode: "timed", duration: 60_000 });

describe("weekly recap", () => {
  it("starts weeks on Monday", () => {
    expect(new Date(startOfWeek(NOW)).getDate()).toBe(21);
    expect(new Date(startOfWeek(at(8, 21, 0))).getDate()).toBe(21);
  });

  it("compares this week with last week", () => {
    const runs = [run(at(8, 14), 60), run(at(8, 16), 70), run(at(8, 21), 80), run(at(8, 21, 20), 84, "Go"), run(at(8, 26), 88)];
    const recap = weeklyRecap(runs, NOW);
    expect(recap.thisWeek).toMatchObject({ runs: 3, days: 2, bestWpm: 88, topLanguage: "TypeScript", minutes: 3 });
    expect(recap.thisWeek.perDay).toEqual([2, 0, 0, 0, 0, 1, 0]);
    expect(recap.lastWeek.runs).toBe(2);
    expect(recap.wpmDelta).toBe(19);
    expect(recapText(recap)).toBe("My week on Codey: 3 runs over 2 days, 84.0 WPM average, +19.0 WPM on last week.");
  });

  it("has no delta without runs in both weeks", () => {
    const recap = weeklyRecap([run(at(8, 25), 70)], NOW);
    expect(recap.wpmDelta).toBeNull();
    expect(recapText(weeklyRecap([], NOW))).toBe("No runs yet this week on Codey.");
  });
});
