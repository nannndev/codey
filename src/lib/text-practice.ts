import type { Snippet, SnippetLength } from "@/types";
import type { Passage } from "@/data/text/passages";

/**
 * Plain-text practice: common words (English or Indonesian) and passages from
 * public-domain novels. The data loads on first use, so the code-only path
 * stays light.
 */

export type TextLanguage = "english" | "indonesian";

export const TEXT_LANGUAGE_NAMES: Record<TextLanguage, string> = { english: "English", indonesian: "Indonesian" };
/** Languages that are prose, not code: shown wrapped, without line numbers. */
export const PROSE_LANGUAGES = new Set(["English", "Indonesian"]);

export const isProse = (snippet: Pick<Snippet, "language"> & { kind?: string }) => snippet.kind === "text" || PROSE_LANGUAGES.has(snippet.language);

export const WORD_COUNT: Record<SnippetLength, number> = { short: 25, medium: 50, long: 100 };
/** Passage length bands, in characters. */
export const PASSAGE_RANGE: Record<SnippetLength, [number, number]> = { short: [0, 230], medium: [230, 360], long: [360, Infinity] };

const WORD_SOURCES: Record<TextLanguage, { repo: string; url: string }> = {
  english: { repo: "Top 1000 words · 16 Project Gutenberg novels", url: "https://www.gutenberg.org/" },
  indonesian: { repo: "Top 1000 kata · FrequencyWords (OpenSubtitles), CC BY-SA 4.0", url: "https://github.com/hermitdave/FrequencyWords" },
};

type Rng = () => number;

/**
 * Random words, weighted towards the most common ones (like real text), with
 * no word twice in a row.
 */
export function pickWords(list: readonly string[], count: number, rng: Rng = Math.random): string[] {
  const words: string[] = [];
  while (words.length < count && list.length) {
    // Squaring the draw leans on the frequent end of the list.
    const word = list[Math.floor(rng() ** 2 * list.length)];
    if (word !== words[words.length - 1]) words.push(word);
  }
  return words;
}

export function wordsSnippet(language: TextLanguage, list: readonly string[], length: SnippetLength, rng: Rng = Math.random): Snippet {
  return {
    id: `words-${language}-${Date.now().toString(36)}`,
    language: TEXT_LANGUAGE_NAMES[language],
    code: pickWords(list, WORD_COUNT[length], rng).join(" "),
    filename: language === "english" ? "Common English words" : "Kata umum bahasa Indonesia",
    source: WORD_SOURCES[language],
    sourceType: "public",
    kind: "text",
  };
}

export function pickPassage(passages: readonly Passage[], length: SnippetLength, rng: Rng = Math.random): Passage {
  const [low, high] = PASSAGE_RANGE[length];
  const fitting = passages.filter((passage) => passage.text.length >= low && passage.text.length < high);
  const pool = fitting.length ? fitting : passages;
  return pool[Math.floor(rng() * pool.length)];
}

export function passageSnippet(passage: Passage): Snippet {
  return {
    id: `passage-${passage.gutenberg}-${passage.text.length}`,
    language: "English",
    code: passage.text,
    filename: passage.title,
    source: { repo: `${passage.title} · ${passage.author}`, url: `https://www.gutenberg.org/ebooks/${passage.gutenberg}` },
    sourceType: "public",
    kind: "text",
  };
}

export interface TextCorpus {
  words: Record<TextLanguage, string[]>;
  passages: Passage[];
}

let corpus: Promise<TextCorpus> | null = null;

export function loadTextCorpus(): Promise<TextCorpus> {
  corpus ??= Promise.all([
    import("@/data/text/english-words"),
    import("@/data/text/indonesian-words"),
    import("@/data/text/passages"),
  ]).then(([english, indonesian, passages]) => ({
    words: { english: english.ENGLISH_WORDS, indonesian: indonesian.INDONESIAN_WORDS },
    passages: passages.PASSAGES,
  }));
  return corpus;
}
