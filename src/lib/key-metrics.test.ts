import { describe, expect, it } from "vitest";
import { computeColumns, drillCharFor, rankKeys, summarize } from "./key-metrics";
import type { KeyboardStatsMap } from "@/utils/keyboard-analytics";

const stat = (key: string, totalPresses: number, accuracy: number, avgDelayMs: number) => {
  const errors = Math.round(totalPresses * (1 - accuracy / 100));
  return { key, totalPresses, errors, accuracy, avgDelayMs, totalDelayMs: avgDelayMs * totalPresses };
};
const stats = {
  A: stat("A", 200, 98, 110),
  P: stat("P", 50, 84, 180),
  "[": stat("[", 20, 75, 260),
  Q: stat("Q", 5, 40, 400),
} as unknown as KeyboardStatsMap;

describe("key metrics", () => {
  it("ranks weak keys worst first, ignoring keys with too few presses", () => {
    expect(rankKeys(stats, "accuracy").map((item) => item.key)).toEqual(["[", "P", "A"]);
    expect(rankKeys(stats, "speed", 1).map((item) => item.key)).toEqual(["["]);
  });

  it("summarizes keystrokes, accuracy and latency across keys", () => {
    const summary = summarize(stats);
    expect(summary.keystrokes).toBe(275);
    expect(summary.tracked).toBe(4);
    expect(summary.accuracy).toBeGreaterThan(80);
    expect(summary.latency).toBeGreaterThan(110);
  });

  it("maps keys to drill characters only where a drill can target them", () => {
    expect(drillCharFor("A")).toBe("a");
    expect(drillCharFor("[")).toBe("[");
    expect(drillCharFor("SHIFT_L")).toBeNull();
  });

  it("marks untracked keys flat and grows columns with errors", () => {
    const columns = new Map(computeColumns(stats, "accuracy").map((column) => [column.id, column]));
    expect(columns.get("Z")).toMatchObject({ tracked: false, height: 0 });
    expect(columns.get("[")!.height).toBeGreaterThan(columns.get("A")!.height);
  });
});
