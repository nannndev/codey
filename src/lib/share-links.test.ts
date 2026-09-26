import { describe, expect, it } from "vitest";
import { platformShareUrl, profileCardUrl, profileShareText, profileShareUrl, runShareUrl, SHARE_PLATFORMS, shareCaption, shareText } from "./share-links";

const result = { wpm: 88.04, accuracy: 97.46, language: "Rust" };

describe("share links", () => {
  it("links to the run page when it has a public id", () => {
    expect(runShareUrl("https://codey.example", "run_1")).toBe("https://codey.example/r/run_1");
    expect(runShareUrl("https://codey.example", null)).toBe("https://codey.example");
  });

  it("writes the score and rank into the text", () => {
    expect(shareText(result)).toContain("88.0 WPM with 97.5% accuracy in Rust");
    expect(shareText(result, 1)).toContain("#1 (Gold)");
    expect(shareText(result, 12)).toContain("#12");
    expect(shareText({ ...result, language: "All" })).toContain("across languages");
    expect(shareCaption("hi", "https://x.test/r/1")).toBe("hi\nhttps://x.test/r/1\n#Codey #typingtest");
  });

  it("builds a valid, encoded intent for every platform", () => {
    const url = "https://codey.example/r/run_1";
    for (const platform of SHARE_PLATFORMS) {
      const intent = new URL(platformShareUrl(platform.id, "a & b #tag", url));
      expect(intent.protocol).toBe("https:");
      expect(decodeURIComponent(intent.search)).toContain(url);
    }
    const threads = new URL(platformShareUrl("threads", "a & b", url));
    expect(threads.hostname).toBe("www.threads.net");
    expect(threads.searchParams.get("text")).toBe(`a & b\n${url}`);
    const x = new URL(platformShareUrl("x", "a & b", url));
    expect(x.searchParams.get("text")).toBe("a & b");
    expect(x.searchParams.get("url")).toBe(url);
  });
});

describe("profile share links", () => {
  it("links to the profile page and its card", () => {
    expect(profileShareUrl("https://codey.example", "user_1")).toBe("https://codey.example/p/user_1");
    expect(profileCardUrl("https://codey.example", "user_1")).toMatch(/^https:\/\/codey\.example\/api\/og\/user_1\?kind=profile&v=\d+$/);
  });

  it("speaks as the owner or about another player", () => {
    expect(profileShareText({ name: "Ada", bestWpm: 101.25, runs: 12 }, true)).toBe("My Codey profile: 101.3 WPM best over 12 runs. Real code, real speed.");
    expect(profileShareText({ name: "Ada", bestWpm: 101.25, runs: 12 }, false)).toBe("Ada on Codey: 101.3 WPM best over 12 runs.");
    expect(profileShareText({ name: "Ada", bestWpm: 0, runs: 0 }, false)).toContain("Ada is practicing");
  });
});
