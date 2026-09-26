import { describe, expect, it } from "vitest";
import { isProse, passageSnippet, pickPassage, pickWords, WORD_COUNT, wordsSnippet } from "./text-practice";
import { ENGLISH_WORDS } from "@/data/text/english-words";
import { INDONESIAN_WORDS } from "@/data/text/indonesian-words";
import { PASSAGES } from "@/data/text/passages";
import { seeded } from "@/utils/radio/music";

describe("text practice", () => {
  it("draws the requested number of words, never the same one twice in a row", () => {
    const words = pickWords(ENGLISH_WORDS, 200, seeded(3));
    expect(words).toHaveLength(200);
    words.forEach((word, index) => expect(word).not.toBe(words[index - 1]));
    // Weighted towards common words: most picks come from the top half.
    const topHalf = new Set(ENGLISH_WORDS.slice(0, 500));
    expect(words.filter((word) => topHalf.has(word)).length).toBeGreaterThan(120);
  });

  it("builds a plain-text snippet with its source", () => {
    const snippet = wordsSnippet("indonesian", INDONESIAN_WORDS, "short", seeded(1));
    expect(snippet.code.split(" ")).toHaveLength(WORD_COUNT.short);
    expect(snippet).toMatchObject({ language: "Indonesian", kind: "text", sourceType: "public" });
    expect(snippet.source?.repo).toContain("CC BY-SA");
    expect(isProse(snippet)).toBe(true);
    expect(isProse({ language: "TypeScript" })).toBe(false);
  });

  it("picks passages by length and credits the book", () => {
    const short = pickPassage(PASSAGES, "short", seeded(2));
    const long = pickPassage(PASSAGES, "long", seeded(2));
    expect(short.text.length).toBeLessThan(230);
    expect(long.text.length).toBeGreaterThanOrEqual(360);
    const snippet = passageSnippet(long);
    expect(snippet.source?.url).toBe(`https://www.gutenberg.org/ebooks/${long.gutenberg}`);
    expect(snippet.source?.repo).toContain(long.author);
  });
});

describe("text corpus", () => {
  it("has clean word lists", () => {
    expect(ENGLISH_WORDS).toHaveLength(1000);
    expect(INDONESIAN_WORDS).toHaveLength(1000);
    for (const word of [...ENGLISH_WORDS, ...INDONESIAN_WORDS]) expect(word).toMatch(/^[a-z]+$/);
    // Names, archaic forms and subtitle noise are filtered out.
    for (const word of ["elizabeth", "darcy", "whale", "thee", "chapter"]) expect(ENGLISH_WORDS).not.toContain(word);
    for (const word of ["oke", "yeah", "bangsat", "diterjemahkan", "fncandara"]) expect(INDONESIAN_WORDS).not.toContain(word);
  });

  it("has typeable passages", () => {
    expect(PASSAGES.length).toBeGreaterThan(300);
    for (const passage of PASSAGES) {
      expect(passage.text).toMatch(/^[\x20-\x7e]+$/);
      expect(passage.text).not.toMatch(/\s{2}|\n/);
    }
  });
});
