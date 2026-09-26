import { describe, expect, it } from "vitest";
import { challengeShareHtml, loadChallenge } from "./challenge-card";

const db = (doc: Record<string, unknown> | null) => ({
  async getDocument() {
    if (!doc) throw Object.assign(new Error("missing"), { code: 404 });
    return doc;
  },
});

describe("challenge cards", () => {
  it("loads the score to beat and a trimmed preview of the code", async () => {
    const code = ["function add(a, b) {", `  return a + b; // ${"x".repeat(60)}`, "}", "", "a", "b", "c", "d"].join("\n");
    const challenge = await loadChallenge("c1", db({ name: "Ada", username: "ada", language: "JavaScript", code, wpm: 91.2, accuracy: 97 }));
    expect(challenge).toMatchObject({ name: "Ada", language: "JavaScript", wpm: 91.2, lines: 8 });
    expect(challenge?.preview).toHaveLength(7);
    expect(challenge?.preview[1].endsWith("...")).toBe(true);
    expect(challenge?.preview[1].length).toBeLessThanOrEqual(47);
  });

  it("rejects bad ids and missing challenges", async () => {
    expect(await loadChallenge("../x", db({}))).toBeNull();
    expect(await loadChallenge("c1", db(null))).toBeNull();
  });

  it("previews with the challenge card and opens the snippet to type", async () => {
    const challenge = await loadChallenge("c1", db({ name: "<Ada>", language: "Go", code: "x", wpm: 80, accuracy: 95 }));
    const html = challengeShareHtml(challenge, "https://codey.example", "c1");
    expect(html).toContain("/api/og/c1?kind=challenge&amp;v=");
    expect(html).toContain('location.replace("https://codey.example/?challenge=c1")');
    expect(html).toContain("&lt;Ada&gt; challenges you: beat 80.0 WPM in Go");
  });
});
