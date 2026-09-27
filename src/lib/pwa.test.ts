import { describe, expect, it } from "vitest";
import { installState, isIos } from "./pwa";

describe("pwa", () => {
  it("spots iOS browsers", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140")).toBe(false);
  });

  it("is not installable before the browser offers it", () => {
    expect(["unsupported", "ios"]).toContain(installState());
  });
});
