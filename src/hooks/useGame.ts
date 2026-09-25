import { useState, useCallback, useRef, useEffect } from 'react';
import type { ErrorDetail, GameStatus, Snippet, GameConfig } from '../types';

interface UseGameOptions {
  config: GameConfig;
  getSnippet: () => Snippet;
  /** Skip a line's leading whitespace after a correct newline. */
  autoIndent?: boolean;
}

/** Index just past the run of spaces/tabs starting at `from`. */
export function whitespaceRunEnd(code: string, from: number): number {
  let end = from;
  while (end < code.length && (code[end] === ' ' || code[end] === '\t')) end += 1;
  return end;
}

interface UseGameReturn {
  snippet: Snippet;
  input: string;
  status: GameStatus;
  elapsedMs: number;
  wpmSnapshots: number[];
  handleKey: (key: string) => void;
  reset: () => void;
  stop: () => void;
  nextSnippet: () => void;
  snippetsCompleted: number;
  secondsRemaining: number;
  keystrokes: number;
  mistakes: number;
  errorHistory: ErrorDetail[];
  completedCorrectChars: number;
  progressSnapshots: Array<{ ms: number; charIndex: number }>;
  loadSnippet: (snippet: Snippet) => void;
  combo: number;
  maxCombo: number;
}

export function useGame({ config, getSnippet, autoIndent = true }: UseGameOptions): UseGameReturn {
  const [snippet, setSnippet] = useState<Snippet>(getSnippet);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<GameStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [wpmSnapshots, setWpmSnapshots] = useState<number[]>([]);
  const [progressSnapshots, setProgressSnapshots] = useState<Array<{ ms: number; charIndex: number }>>([]);
  const [snippetsCompleted, setSnippetsCompleted] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(config.duration ?? 0);
  const [keystrokes, setKeystrokes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [errorHistory, setErrorHistory] = useState<ErrorDetail[]>([]);
  const [completedCorrectChars, setCompletedCorrectChars] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const snapshotIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const correctCharsRef = useRef(0);
  const completedCorrectCharsRef = useRef(0);
  const typedAttemptsRef = useRef(0);
  // Refs mirror state so rapid keys between renders see the latest values,
  // and so no side effects run inside state updaters (StrictMode replays them).
  const snippetRef = useRef(snippet);
  const inputRef = useRef('');
  const currentCorrectRef = useRef(0);
  const comboRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (snapshotIntervalRef.current !== null) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (startRef.current !== null) {
      setElapsedMs(performance.now() - startRef.current);
      startRef.current = null;
    }
    clearTimers();
    setStatus('finished');
  }, [clearTimers]);

  const startTimers = useCallback(() => {
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current !== null) {
        setElapsedMs(performance.now() - startRef.current);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    snapshotIntervalRef.current = window.setInterval(() => {
      if (startRef.current === null) return;
      const ms = performance.now() - startRef.current;
      const minutes = ms / 60000;
      setWpmSnapshots((prev) => {
        const wpm = minutes > 0
          ? Math.round((correctCharsRef.current / 5 / minutes) * 10) / 10
          : 0;
        return [...prev, wpm];
      });
    }, 1000);

    if (config.mode === 'timed' && config.duration) {
      let remaining = config.duration;
      setSecondsRemaining(remaining);
      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          finish();
        }
      }, 1000);
    }
  }, [config, finish]);

  const commitInput = useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const commitSnippet = useCallback((next: Snippet) => {
    snippetRef.current = next;
    currentCorrectRef.current = 0;
    setSnippet(next);
  }, []);

  const handleKey = useCallback(
    (key: string) => {
      if (status === 'finished' || finishedRef.current) return;

      if (status === 'idle' && startRef.current === null) {
        setStatus('running');
        startTimers();
      }

      const code = snippetRef.current.code;
      const prev = inputRef.current;

      if (key === "Backspace") {
        if (prev.length === 0) return;
        const last = prev.length - 1;
        if (prev[last] === code[last]) currentCorrectRef.current -= 1;
        correctCharsRef.current = completedCorrectCharsRef.current + currentCorrectRef.current;
        commitInput(prev.slice(0, -1));
        return;
      }

      // "\t" is the Tab key: fill the snippet's own indentation run instead of
      // a fixed width, so 4-space and tab-indented code are typed correctly.
      const indentRun = key === '\t' ? whitespaceRunEnd(code, prev.length) - prev.length : 0;
      if (key.length !== 1) return;

      const position = prev.length;
      const expected = code[position] ?? '';
      const typed = indentRun > 0 ? code.slice(position, position + indentRun) : key;
      const isCorrect = indentRun > 0 || key === expected;
      const attemptIndex = typedAttemptsRef.current;
      typedAttemptsRef.current += 1;
      setKeystrokes((count) => count + 1);

      if (isCorrect) {
        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        setCombo(nextCombo);
        setMaxCombo((max) => Math.max(max, nextCombo));
      } else {
        comboRef.current = 0;
        setMistakes((count) => count + 1);
        setCombo(0);
        setErrorHistory((errors) => [
          ...errors,
          { index: position, attemptIndex, expected, typed: key },
        ].slice(-200));
      }

      let next = prev + typed;
      if (isCorrect) currentCorrectRef.current += typed.length;

      // Auto-indent: after a correct newline, skip the next line's leading
      // whitespace the way an editor would.
      if (autoIndent && key === '\n' && isCorrect) {
        const indentEnd = whitespaceRunEnd(code, next.length);
        if (indentEnd > next.length) {
          currentCorrectRef.current += indentEnd - next.length;
          next = code.slice(0, indentEnd);
        }
      }

      correctCharsRef.current = completedCorrectCharsRef.current + currentCorrectRef.current;

      if (startRef.current !== null) {
        const currentMs = Math.round(performance.now() - startRef.current);
        setProgressSnapshots((prevSnaps) => [
          ...prevSnaps,
          { ms: currentMs, charIndex: next.length },
        ]);
      }

      if (next.length >= code.length) {
        if (config.mode === 'snippet') {
          commitInput(next);
          finish();
          return;
        }
        completedCorrectCharsRef.current += currentCorrectRef.current;
        correctCharsRef.current = completedCorrectCharsRef.current;
        setCompletedCorrectChars(completedCorrectCharsRef.current);
        setSnippetsCompleted((n) => n + 1);
        commitSnippet(getSnippet());
        commitInput('');
        return;
      }
      commitInput(next);
    },
    [status, config, startTimers, finish, getSnippet, autoIndent, commitInput, commitSnippet],
  );

  const reset = useCallback(() => {
    clearTimers();
    finishedRef.current = false;
    correctCharsRef.current = 0;
    completedCorrectCharsRef.current = 0;
    typedAttemptsRef.current = 0;
    commitInput('');
    setStatus('idle');
    setElapsedMs(0);
    setWpmSnapshots([]);
    setProgressSnapshots([]);
    setSnippetsCompleted(0);
    setSecondsRemaining(config.duration ?? 0);
    setKeystrokes(0);
    setMistakes(0);
    setErrorHistory([]);
    setCompletedCorrectChars(0);
    comboRef.current = 0;
    setCombo(0);
    setMaxCombo(0);
    commitSnippet(getSnippet());
  }, [clearTimers, config.duration, getSnippet, commitInput, commitSnippet]);

  const nextSnippet = useCallback(() => {
    commitSnippet(getSnippet());
    commitInput('');
    comboRef.current = 0;
    setCombo(0);
  }, [getSnippet, commitInput, commitSnippet]);

  const loadSnippet = useCallback((next: Snippet) => {
    clearTimers();
    finishedRef.current = false;
    correctCharsRef.current = 0;
    completedCorrectCharsRef.current = 0;
    typedAttemptsRef.current = 0;
    commitSnippet(next);
    commitInput('');
    setStatus('idle');
    setElapsedMs(0);
    setWpmSnapshots([]);
    setProgressSnapshots([]);
    setSnippetsCompleted(0);
    setKeystrokes(0);
    setMistakes(0);
    setErrorHistory([]);
    setCompletedCorrectChars(0);
    comboRef.current = 0;
    setCombo(0);
    setMaxCombo(0);
  }, [clearTimers, commitInput, commitSnippet]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    snippet,
    input,
    status,
    elapsedMs,
    wpmSnapshots,
    progressSnapshots,
    handleKey,
    reset,
    stop: finish,
    nextSnippet,
    snippetsCompleted,
    secondsRemaining,
    keystrokes,
    mistakes,
    errorHistory,
    completedCorrectChars,
    loadSnippet,
    combo,
    maxCombo,
  };
}
