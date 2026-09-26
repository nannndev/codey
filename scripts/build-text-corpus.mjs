#!/usr/bin/env node
/**
 * Builds the word lists and passages behind the text practice modes.
 *
 *   node scripts/build-text-corpus.mjs
 *
 * English words and passages come from public-domain novels (Project
 * Gutenberg, via the GITenberg mirror). Indonesian words come from Hermit
 * Dave's FrequencyWords list (OpenSubtitles 2018), CC BY-SA 4.0.
 * Output: src/data/text/*.ts. Re-running is deterministic.
 */
import { writeFileSync } from "node:fs";

const BOOKS = [
  ["Pride and Prejudice", "Jane Austen", "Pride-and-Prejudice_1342", 1342],
  ["The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "The-Adventures-of-Sherlock-Holmes_1661", 1661],
  ["Alice's Adventures in Wonderland", "Lewis Carroll", "Alice-s-Adventures-in-Wonderland_11", 11],
  ["Frankenstein", "Mary Shelley", "Frankenstein_84", 84],
  ["A Tale of Two Cities", "Charles Dickens", "A-Tale-of-Two-Cities_98", 98],
  ["The Time Machine", "H. G. Wells", "The-Time-Machine_35", 35],
  ["Treasure Island", "Robert Louis Stevenson", "Treasure-Island_120", 120],
  ["The Adventures of Tom Sawyer", "Mark Twain", "The-Adventures-of-Tom-Sawyer_74", 74],
  ["Moby-Dick", "Herman Melville", "Moby-Dick--Or-The-Whale_2701", 2701],
  ["Little Women", "Louisa May Alcott", "Little-Women_514", 514],
  ["The Picture of Dorian Gray", "Oscar Wilde", "The-Picture-of-Dorian-Gray_174", 174],
  ["Dracula", "Bram Stoker", "Dracula_345", 345],
  ["The Wonderful Wizard of Oz", "L. Frank Baum", "The-Wonderful-Wizard-of-Oz_55", 55],
  ["Peter Pan", "J. M. Barrie", "Peter-Pan_16", 16],
  ["Great Expectations", "Charles Dickens", "Great-Expectations_1400", 1400],
  ["The Call of the Wild", "Jack London", "The-Call-of-the-Wild_215", 215],
];
const PASSAGES_PER_BOOK = 26;

const INDONESIAN_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/id/id_50k.txt";
// Insults, slurs and violence that subtitles are full of, plus common foreign names.
const INDONESIAN_BLOCK = new Set(`
anjing bajingan brengsek sialan sial bangsat keparat persetan bego tolol goblok bodoh idiot jalang pelacur kontol memek ngentot
bunuh membunuh dibunuh pembunuh pembunuhan tembak menembak ditembak pistol mayat darah neraka setan iblis
john jack michael david james peter paul sam tom mike frank harry charlie max ben nick joe george steve tony lee kim clark york don
membunuhnya membunuhmu membunuhku tewas tembakan peluru bom senjata serangan menyerang pedang
diterjemahkan terjemahan subtitle sub oke ok okay oh hei hey yeah uh um eh ah ha hah huh hmm ooh whoa wow hi hello mr ny tn yg ku mu nya lu gue gak apos fncandara
`.trim().split(/\s+/));

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
};

/** The book's own text, without Project Gutenberg's header, footer and licence. */
function body(text) {
  const start = text.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  const end = text.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  const from = start >= 0 ? text.indexOf("\n", start) + 1 : 0;
  return text.slice(from, end > 0 ? end : undefined).replace(/\r/g, "");
}

/** Plain ASCII prose: straight quotes, no italics markers, single spaces. */
function clean(paragraph) {
  return paragraph
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const counts = new Map();
const lowercase = new Map();
// Archaic forms and words that only one book uses a lot.
const ENGLISH_BLOCK = new Set("chapter whale whales sperm mrs mr dr st em ye thee thou thy aye scarecrow ahab queequeg lorry van tis de".split(" "));
const passages = [];

for (const [title, author, repo, id] of BOOKS) {
  const text = body(await fetchText(`https://raw.githubusercontent.com/GITenberg/${repo}/master/${id}.txt`));

  // Word counts, and how often each word is written in lower case: names almost never are.
  for (const match of text.matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
    const word = match[0];
    if (word.includes("'")) continue;
    const lower = word.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
    if (word === lower) lowercase.set(lower, (lowercase.get(lower) ?? 0) + 1);
  }

  const candidates = text
    .split(/\n\s*\n/)
    .map(clean)
    .filter((paragraph) =>
      paragraph.length >= 140 && paragraph.length <= 460 &&
      /^[\x20-\x7e]+$/.test(paragraph) &&
      /[.!?"]$/.test(paragraph) &&
      !/\[|\]|\*|CHAPTER|Chapter [IVXL\d]|^[A-Z\s.,]+$/.test(paragraph) &&
      !/\d{3,}/.test(paragraph),
    );
  const step = Math.max(1, Math.floor(candidates.length / PASSAGES_PER_BOOK));
  for (let index = 0, taken = 0; index < candidates.length && taken < PASSAGES_PER_BOOK; index += step, taken += 1) {
    passages.push({ text: candidates[index], title, author, gutenberg: id });
  }
  console.log(`${title}: ${candidates.length} usable paragraphs`);
}

const english = [...counts.entries()]
  .filter(([word, count]) => {
    if (word.length < 2 && word !== "a") return false;
    if (ENGLISH_BLOCK.has(word)) return false;
    return (lowercase.get(word) ?? 0) / count >= 0.5;
  })
  .sort((a, b) => b[1] - a[1])
  .slice(0, 1000)
  .map(([word]) => word);

const englishCommon = new Set(english.slice(0, 300));
const indonesian = (await fetchText(INDONESIAN_URL))
  .split("\n")
  .map((line) => line.split(" ")[0]?.trim().toLowerCase())
  .filter((word) => word && /^[a-z]{2,}$/.test(word) && !INDONESIAN_BLOCK.has(word) && !englishCommon.has(word))
  .slice(0, 1000);

const header = (source) => `// Generated by scripts/build-text-corpus.mjs. Do not edit by hand.\n// ${source}\n\n`;
writeFileSync("src/data/text/english-words.ts", `${header("Most common words in 16 public-domain novels (Project Gutenberg), names removed.")}export const ENGLISH_WORDS: string[] = ${JSON.stringify(english)};\n`);
writeFileSync("src/data/text/indonesian-words.ts", `${header("Derived from FrequencyWords by Hermit Dave (OpenSubtitles 2018), CC BY-SA 4.0: https://github.com/hermitdave/FrequencyWords")}export const INDONESIAN_WORDS: string[] = ${JSON.stringify(indonesian)};\n`);
writeFileSync("src/data/text/passages.ts", `${header("Passages from public-domain novels (Project Gutenberg).")}export interface Passage {\n  text: string;\n  title: string;\n  author: string;\n  /** Project Gutenberg ebook number. */\n  gutenberg: number;\n}\n\nexport const PASSAGES: Passage[] = ${JSON.stringify(passages, null, 1)};\n`);
console.log(`\n${english.length} English words, ${indonesian.length} Indonesian words, ${passages.length} passages.`);
