// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { celebrationFor, celebrationLine, emitKap, KAP_EVENT } from "./kap-events";

describe("kap events", () => {
  it("cheers loudest for a personal best", () => {
    expect(celebrationFor({ wpm: 90, accuracy: 95 }, 80)).toBe("pb");
    expect(celebrationFor({ wpm: 90, accuracy: 95 }, null)).toBe("pb");
    expect(celebrationFor({ wpm: 70, accuracy: 98 }, 80)).toBe("good");
    expect(celebrationFor({ wpm: 70, accuracy: 92 }, 80)).toBe("finish");
    // Custom drills never count as a personal best.
    expect(celebrationFor({ wpm: 120, accuracy: 92 }, 80, true)).toBe("finish");
  });

  it("says something that fits", () => {
    expect(celebrationLine("pb", { wpm: 1, accuracy: 1 })).toMatch(/personal best/);
    expect(celebrationLine("finish", { wpm: 50, accuracy: 85 })).toMatch(/accuracy/);
  });

  it("broadcasts on window", () => {
    const listener = vi.fn();
    window.addEventListener(KAP_EVENT, listener);
    emitKap({ type: "key", error: true });
    window.removeEventListener(KAP_EVENT, listener);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ type: "key", error: true });
  });
});
