import type { RunResult, SnippetLength } from '../types';

export interface SnippetLengthSpec {
  targetBlocks: number;
  minChars: number;
  maxChars: number;
}

/**
 * One source of truth for what each snippet length means. `useSnippets` builds
 * runs to these bounds and the leaderboard only ranks runs that landed inside
 * them, so a "medium" score is always comparable with another "medium" score.
 */
export const SNIPPET_LENGTH_SPEC: Record<SnippetLength, SnippetLengthSpec> = {
  short: { targetBlocks: 1, minChars: 120, maxChars: 250 },
  medium: { targetBlocks: 2, minChars: 330, maxChars: 650 },
  long: { targetBlocks: 4, minChars: 800, maxChars: 1400 },
};

/** Plain-text boards; they stay out of the code "All" board. */
export const TEXT_BOARDS = ['English', 'Indonesian', 'Passages'] as const;
export const isTextLanguage = (language: string) => (TEXT_BOARDS as readonly string[]).includes(language);

/** A snippet finishes on input length, not correctness, so speed without accuracy is not a score. */
export const MIN_RANKED_ACCURACY = 90;
/** Minimum WPM threshold required to qualify for the Ranked Leaderboard. */
export const MIN_RANKED_WPM = 20;

export type RankRejection = 'custom' | 'zen' | 'accuracy' | 'wpm' | 'length';

export function rankRejectionReason(run: RunResult): RankRejection | null {
  if (run.sourceType === 'custom') return 'custom';
  if (run.mode === 'zen') return 'zen';
  if (run.accuracy < MIN_RANKED_ACCURACY) return 'accuracy';
  if (run.wpm < MIN_RANKED_WPM) return 'wpm';
  if (run.mode === 'snippet') {
    if (!run.snippetLength) return 'length';
    if (!isWithinLengthSpec(run.snippetLength, run.targetChars)) return 'length';
  }
  return null;
}

/**
 * Runs recorded before `targetChars` was tracked cannot be measured, so they keep
 * their place rather than disappearing from boards they already rank on.
 */
export function isWithinLengthSpec(length: SnippetLength | undefined, targetChars: number | undefined): boolean {
  const effectiveLength = length ?? 'medium';
  if (targetChars === undefined) return true;
  const spec = SNIPPET_LENGTH_SPEC[effectiveLength];
  if (!spec) return true;
  return targetChars >= Math.floor(spec.minChars * 0.6) && targetChars <= Math.ceil(spec.maxChars * 1.4);
}

export function isRankEligible(run: RunResult): boolean {
  return rankRejectionReason(run) === null;
}

export function describeRankRejection(reason: RankRejection): string {
  switch (reason) {
    case 'custom':
      return 'Custom and drill practice stays local.';
    case 'zen':
      return 'Zen runs have no fixed target to compare.';
    case 'accuracy':
      return `Leaderboard runs need at least ${MIN_RANKED_ACCURACY}% accuracy.`;
    case 'wpm':
      return `Leaderboard runs need at least ${MIN_RANKED_WPM} WPM.`;
    case 'length':
      return 'This snippet fell outside the length its category guarantees.';
  }
}

export type RunKind = 'code' | 'text';

/** Plain-text practice (words, passages) is far faster than code, so bests and divisions keep them apart. */
export const runKind = (language: string): RunKind => (isTextLanguage(language) ? 'text' : 'code');

/** The fastest run of each kind. */
export function bestByKind<T extends { wpm: number; language: string }>(runs: T[]): Record<RunKind, T | null> {
  const best: Record<RunKind, T | null> = { code: null, text: null };
  for (const run of runs) {
    const kind = runKind(run.language);
    if (!best[kind] || run.wpm > best[kind]!.wpm) best[kind] = run;
  }
  return best;
}
