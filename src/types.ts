export interface Snippet {
  id: string;
  language: string;
  code: string;
  filename?: string;
  source?: {
    repo: string;
    url: string;
  };
  sourceType?: 'public' | 'custom';
}

export type SnippetLength = 'short' | 'medium' | 'long';

export type GameStatus = 'idle' | 'running' | 'finished';
export type TestMode = 'snippet' | 'timed' | 'zen';
export type TimedDuration = 15 | 30 | 60 | 120;
export type CursorStyle = 'block' | 'underline' | 'line';

export interface GameConfig {
  mode: TestMode;
  duration: TimedDuration | null;
}

export interface CharState {
  char: string;
  status: 'pending' | 'correct' | 'incorrect';
  isCurrent: boolean;
}

export interface PerLineStats {
  lineIndex: number;
  charsTyped: number;
  errors: number;
  accuracy: number;
}

export interface ErrorDetail {
  index: number;
  attemptIndex?: number;
  expected: string;
  typed: string;
}

export interface RunResult {
  id?: string;
  snippetId?: string;
  filename?: string;
  sourceRepo?: string;
  language: string;
  wpm: number;
  accuracy: number;
  duration: number;
  charsTyped: number;
  timestamp: number;
  mode: TestMode;
  rawWpm: number;
  consistency: number;
  totalErrors: number;
  totalCorrect: number;
  perLineStats: PerLineStats[];
  errorPositions: ErrorDetail[];
  snippetsCompleted: number;
  targetChars?: number;
  sourceType?: 'public' | 'custom';
  wpmSnapshots?: number[];
  progressSnapshots?: Array<{ ms: number; charIndex: number }>;
  snippetLength?: SnippetLength;
  maxCombo?: number;
  /** Cloud document id when the run came from (or was verified by) the server. */
  cloudId?: string;
}

export interface GhostRunnerState {
  hasPb: boolean;
  targetWpm: number;
  ghostCharIndex: number;
  deltaWpm: number;
  deltaChars: number;
}

export interface PersonalBest {
  language: string;
  mode: TestMode;
  duration: number | null;
  snippetLength?: SnippetLength;
  bestWpm: number;
  bestAccuracy: number;
  bestConsistency: number;
  lastRunAt: number;
  totalRuns: number;
}

export interface Settings {
  version: 1;
  goals: {
    runsPerDay: number;
    minutesPerDay: number;
    charsPerDay: number;
  };
  achievements: string[];
}

export interface HistoryFilter {
  language: string;
  mode: TestMode | 'all';
  timeRange: 'all' | '30d' | '7d';
}
