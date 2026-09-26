import { describe, expect, it } from "vitest";
import { bucketTrace, encodeTrace, parseTrace, traceFromIntervals, traceFromSnapshots, TRACE_BARS } from "./speed-trace";

describe("speed trace", () => {
  it("averages long series into a fixed number of bars", () => {
    expect(bucketTrace([1, 2, 3])).toEqual([1, 2, 3]);
    const bars = bucketTrace(Array.from({ length: 64 }, (_, i) => i), 16);
    expect(bars).toHaveLength(16);
    expect(bars[0]).toBe(2);
    expect(bars[15]).toBe(62);
  });

  it("turns running averages back into the pace of each second", () => {
    // 60 wpm in second one, 120 in second two: the running average is 60 then 90.
    expect(traceFromSnapshots([60, 90, 100])).toEqual([60, 120, 120]);
  });

  it("measures pace from keystroke gaps", () => {
    // One key every 100 ms is 600 keys a minute, 120 wpm.
    const trace = traceFromIntervals(new Array(160).fill(100), 16_000);
    expect(trace).toHaveLength(TRACE_BARS);
    expect(new Set(trace)).toEqual(new Set([120]));
    expect(traceFromIntervals([100, 100], 200)).toEqual([]);
  });

  it("stores and reads back only sane values", () => {
    expect(encodeTrace([99.6, 120, 131.2])).toBe("100,120,131");
    expect(encodeTrace([1, 2])).toBeUndefined();
    expect(parseTrace("100,120,131")).toEqual([100, 120, 131]);
    expect(parseTrace("100,abc,131")).toEqual([]);
    expect(parseTrace("100,9999,131")).toEqual([]);
    expect(parseTrace(null)).toEqual([]);
  });
});
