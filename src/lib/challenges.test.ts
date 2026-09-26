import { describe, expect, it } from "vitest";
import { canChallenge, challengeShareText, challengeShareUrl, challengeSnippet, judgeChallenge, type Challenge } from "./challenges";
import type { RunResult, Snippet } from "@/types";

const snippet: Snippet = { id: "s1", language: "TypeScript", code: "const a = 1;\n", sourceType: "public", source: { repo: "a/b", url: "https://github.com/a/b" } };
const result = { mode: "snippet", wpm: 80, accuracy: 96 } as RunResult;
const challenge: Challenge = { id: "c1", userId: "u", name: "Ada", username: "ada", language: "TypeScript", code: "const a = 1;\n", filename: "a.ts", sourceRepo: "a/b", sourceUrl: null, wpm: 80, accuracy: 95, createdAt: "" };

describe("challenges", () => {
  it("only offers public snippet runs as challenges", () => {
    expect(canChallenge(snippet, result)).toBe(true);
    expect(canChallenge({ ...snippet, sourceType: "custom" }, result)).toBe(false);
    expect(canChallenge(snippet, { ...result, mode: "timed" })).toBe(false);
    expect(canChallenge({ ...snippet, code: "x".repeat(20_000) }, result)).toBe(false);
    expect(canChallenge(null, result)).toBe(false);
  });

  it("rebuilds the exact snippet as a public one, so the run counts", () => {
    const rebuilt = challengeSnippet(challenge);
    expect(rebuilt).toMatchObject({ id: "challenge-c1", code: challenge.code, language: "TypeScript", sourceType: "public", filename: "a.ts" });
    expect(rebuilt.source).toEqual({ repo: "a/b", url: "https://github.com/a/b" });
  });

  it("judges on speed, then accuracy", () => {
    expect(judgeChallenge(challenge, { wpm: 91.25, accuracy: 90 })).toEqual({ won: true, margin: 11.3, tie: false });
    expect(judgeChallenge(challenge, { wpm: 70, accuracy: 100 })).toMatchObject({ won: false, margin: -10 });
    expect(judgeChallenge(challenge, { wpm: 80, accuracy: 96 })).toEqual({ won: true, margin: 0, tie: false });
    expect(judgeChallenge(challenge, { wpm: 80, accuracy: 95 })).toEqual({ won: false, margin: 0, tie: true });
  });

  it("writes the link and the dare", () => {
    expect(challengeShareUrl("https://codey.example", "c1")).toBe("https://codey.example/c/c1");
    expect(challengeShareText({ wpm: 88.44, language: "Go" }, true)).toBe("I typed this snippet at 88.4 WPM in Go. Can you beat me?");
    expect(challengeShareText({ wpm: 88.44, language: "All" }, false, "Ada")).toBe("Ada typed this snippet at 88.4 WPM. Can you beat it?");
  });
});
