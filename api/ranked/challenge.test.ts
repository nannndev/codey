import { describe, expect, it } from "vitest";
import { selectSnippetCode } from "./challenge";
import { isWithinLengthSpec } from "../../src/utils/ranking";
import type { SnippetLength } from "../../src/types";

describe("Ranked text challenges", () => {
  for (const board of ["English", "Indonesian", "Passages"]) {
    for (const length of ["short", "medium", "long"] as SnippetLength[]) {
      it(`sizes ${board} ${length} to the ranked length band`, () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { code, targetChars } = selectSnippetCode(board, length);
          expect(targetChars).toBe(code.length);
          expect(isWithinLengthSpec(length, targetChars)).toBe(true);
          expect(code).not.toMatch(/\n/);
        }
      });
    }
  }

  it("still serves code for code languages", () => {
    const { code } = selectSnippetCode("TypeScript", "short");
    expect(code.length).toBeGreaterThan(0);
  });
});
