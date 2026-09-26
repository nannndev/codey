// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { getPersonalBest, getPersonalBests } from "./storage";
import type { RunResult, TestMode } from "@/types";

let clock = 1_700_000_000_000;
function run(overrides: Partial<RunResult>): RunResult {
  clock += 60_000;
  return {
    id: `run-${clock}`,
    language: "TypeScript",
    wpm: 60,
    accuracy: 95,
    duration: 45_000,
    charsTyped: 300,
    timestamp: clock,
    mode: "snippet" as TestMode,
    rawWpm: 64,
    consistency: 80,
    totalErrors: 3,
    totalCorrect: 297,
    perLineStats: [],
    errorPositions: [],
    snippetsCompleted: 1,
    snippetLength: "medium",
    ...overrides,
  };
}
const save = (runs: RunResult[]) => localStorage.setItem("codetype_history", JSON.stringify(runs));

beforeEach(() => localStorage.clear());

describe("personal bests", () => {
  it("groups snippet runs by length, whatever each run's elapsed time", () => {
    // Regression: every snippet run used to be its own "best" keyed by elapsed ms.
    save([run({ duration: 41_230, wpm: 55 }), run({ duration: 52_871, wpm: 72 }), run({ duration: 38_004, wpm: 64 })]);
    const bests = getPersonalBests();
    expect(bests).toHaveLength(1);
    expect(bests[0]).toMatchObject({ language: "TypeScript", mode: "snippet", snippetLength: "medium", bestWpm: 72, totalRuns: 3, duration: null });
  });

  it("keeps different snippet lengths and languages apart", () => {
    save([run({ snippetLength: "short" }), run({ snippetLength: "long" }), run({ language: "Go" })]);
    expect(getPersonalBests()).toHaveLength(3);
  });

  it("groups timed runs by whole seconds on the clock", () => {
    save([
      run({ mode: "timed", duration: 30_004, wpm: 70, snippetLength: undefined }),
      run({ mode: "timed", duration: 29_998, wpm: 75, snippetLength: undefined }),
      run({ mode: "timed", duration: 60_010, wpm: 65, snippetLength: undefined }),
    ]);
    const bests = getPersonalBests().sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
    expect(bests).toHaveLength(2);
    expect(bests[0]).toMatchObject({ bestWpm: 75, totalRuns: 2 });
  });

  it("finds the previous best for a new run of the same kind", () => {
    save([run({ duration: 41_230, wpm: 58 }), run({ duration: 60_100, wpm: 63 })]);
    // A fresh run has its own elapsed time; the lookup must still match.
    expect(getPersonalBest("TypeScript", "snippet", 47_512, "medium")?.bestWpm).toBe(63);
    expect(getPersonalBest("TypeScript", "snippet", 47_512, "short")).toBeNull();
    expect(getPersonalBest("Python", "snippet", 47_512, "medium")).toBeNull();
  });

  it("matches timed runs on the rounded clock", () => {
    save([run({ mode: "timed", duration: 30_020, wpm: 81, snippetLength: undefined })]);
    expect(getPersonalBest("TypeScript", "timed", 29_990)?.bestWpm).toBe(81);
    expect(getPersonalBest("TypeScript", "timed", 60_000)).toBeNull();
  });
});
