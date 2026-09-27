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

describe("kap buddy position", async () => {
  const { placeBuddy } = await import("./kap-buddy");
  const box = { width: 128, height: 162 };
  const view = { width: 1440, height: 900 };

  it("starts bottom-left", () => {
    expect(placeBuddy(null, box, view)).toEqual({ left: 12, top: 900 - 162 - 12 });
  });

  it("keeps Kap on screen when dragged off or the window shrinks", () => {
    expect(placeBuddy({ x: -1, y: 2 }, box, view)).toEqual({ left: 8, top: 900 - 162 - 8 });
    expect(placeBuddy({ x: 0.95, y: 0.5 }, box, { width: 1280, height: 700 })).toEqual({ left: 1280 - 128 - 8, top: 350 });
  });
});
