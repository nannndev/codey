import { describe, expect, it } from "vitest";
import { platformShareUrl, runShareUrl, SHARE_PLATFORMS, shareCaption, shareText } from "./share-links";

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
