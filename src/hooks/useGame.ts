import { useState, useCallback, useRef, useEffect } from 'react';
import type { ErrorDetail, GameStatus, Snippet, GameConfig } from '../types';

interface UseGameOptions {
  config: GameConfig;
  getSnippet: () => Snippet;
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

export function useGame({ config, getSnippet }: UseGameOptions): UseGameReturn {
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

  const handleKey = useCallback(
    (key: string) => {
      if (status === 'finished') return;

      if (status === 'idle') {
        setStatus('running');
        startTimers();
      }

      if (key === "Backspace") {
        setInput((prev) => {
          const next = prev.slice(0, -1);
          const currentCorrect = [...next].filter((char, index) => char === snippet.code[index]).length;
          correctCharsRef.current = completedCorrectCharsRef.current + currentCorrect;
          return next;
        });
        return;
      }

      if (key.length === 1) {
        setInput((prev) => {
          const position = prev.length;
          const expected = snippet.code[position] ?? '';
          const attemptIndex = typedAttemptsRef.current;
          typedAttemptsRef.current += 1;
          setKeystrokes((count) => count + 1);
          if (key !== expected) {
            setMistakes((count) => count + 1);
            setCombo(0);
            setErrorHistory((errors) => [
              ...errors,
              { index: position, attemptIndex, expected, typed: key },
            ].slice(-200));
          } else {
            setCombo((c) => {
              const nextCombo = c + 1;
              setMaxCombo((max) => Math.max(max, nextCombo));
              return nextCombo;
            });
          }

          const next = prev + key;
          const newCorrect = [...next].filter((c, i) => c === snippet.code[i]).length;
          correctCharsRef.current = completedCorrectCharsRef.current + newCorrect;

          if (startRef.current !== null) {
            const currentMs = Math.round(performance.now() - startRef.current);
            setProgressSnapshots((prevSnaps) => [
              ...prevSnaps,
              { ms: currentMs, charIndex: next.length },
            ]);
          }

          if (next.length >= snippet.code.length) {
            if (config.mode === 'snippet') {
              finish();
            } else {
              completedCorrectCharsRef.current += newCorrect;
              correctCharsRef.current = completedCorrectCharsRef.current;
              setCompletedCorrectChars(completedCorrectCharsRef.current);
              setSnippetsCompleted((n) => n + 1);
              setSnippet(getSnippet());
              return '';
            }
          }
          return next;
        });
      }
    },
    [status, snippet, config, startTimers, finish, getSnippet],
  );

  const reset = useCallback(() => {
    clearTimers();
    finishedRef.current = false;
    correctCharsRef.current = 0;
    completedCorrectCharsRef.current = 0;
    typedAttemptsRef.current = 0;
    setInput('');
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
    setCombo(0);
    setMaxCombo(0);
    setSnippet(getSnippet());
  }, [clearTimers, config.duration, getSnippet]);

  const nextSnippet = useCallback(() => {
    setSnippet(getSnippet());
    setInput('');
    setCombo(0);
  }, [getSnippet]);

  const loadSnippet = useCallback((next: Snippet) => {
    clearTimers();
    finishedRef.current = false;
    correctCharsRef.current = 0;
    completedCorrectCharsRef.current = 0;
    typedAttemptsRef.current = 0;
    setSnippet(next);
    setInput('');
    setStatus('idle');
    setElapsedMs(0);
    setWpmSnapshots([]);
    setProgressSnapshots([]);
    setSnippetsCompleted(0);
    setKeystrokes(0);
    setMistakes(0);
    setErrorHistory([]);
    setCompletedCorrectChars(0);
    setCombo(0);
    setMaxCombo(0);
  }, [clearTimers]);

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
