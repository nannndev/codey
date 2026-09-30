import { describe, expect, it } from "vitest";
import { bestByKind, runKind } from "./ranking";

describe("code vs plain text", () => {
  it("tells words and passages apart from code", () => {
    expect(runKind("English")).toBe("text");
    expect(runKind("Passages")).toBe("text");
    expect(runKind("TypeScript")).toBe("code");
  });

  it("keeps a separate best for each", () => {
    const best = bestByKind([
      { wpm: 130, language: "English" },
      { wpm: 88, language: "Go" },
      { wpm: 95, language: "Rust" },
      { wpm: 110, language: "Indonesian" },
    ]);
    expect(best.code?.language).toBe("Rust");
    expect(best.text?.wpm).toBe(130);
    expect(bestByKind([{ wpm: 50, language: "English" }]).code).toBeNull();
  });
});
