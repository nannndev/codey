import { useCallback, useRef, useState } from "react";
import {
  dailySnippet,
  getDailyBoard,
  invalidateDailyBoard,
  startDailyAttempt,
  submitDailyAttempt,
  type DailyChallenge,
  type DailySubmitResult,
} from "@/lib/daily";
import type { Snippet } from "@/types";

export type DailyStatus = "idle" | "loading" | "ready" | "practice" | "submitting" | "verified" | "rejected";

/**
 * Daily challenge lifecycle on the typing screen: load today's snippet, open a
 * verified attempt when signed in, collect key timings and submit on finish.
 */
export function useDailyGame() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<DailyStatus>("idle");
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DailySubmitResult | null>(null);

  /** Read synchronously by the snippet source so resets keep the daily code. */
  const snippetRef = useRef<Snippet | null>(null);
  const sessionRef = useRef<{ sessionId: string; date: string } | null>(null);
  const submittedRef = useRef<string | null>(null);
  const intervalsRef = useRef<number[]>([]);
  const lastKeyRef = useRef<number | null>(null);

  const openAttempt = useCallback(async (signedIn: boolean) => {
    intervalsRef.current = [];
    lastKeyRef.current = null;
    sessionRef.current = null;
    setOutcome(null);
    setError(null);
    if (!signedIn) {
      setStatus("practice");
      return;
    }
    try {
      sessionRef.current = await startDailyAttempt();
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daily attempt could not be started.");
      setStatus("rejected");
    }
  }, []);

  const enter = useCallback(async (userId: string | null): Promise<Snippet | null> => {
    setStatus("loading");
    setError(null);
    try {
      const board = await getDailyBoard(userId);
      const snippet = dailySnippet(board.challenge);
      snippetRef.current = snippet;
      setChallenge(board.challenge);
      setActive(true);
      await openAttempt(Boolean(userId));
      return snippet;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Today's challenge could not be loaded.");
      setStatus("rejected");
      return null;
    }
  }, [openAttempt]);

  const recordKeypress = useCallback(() => {
    const now = performance.now();
    if (lastKeyRef.current !== null) intervalsRef.current.push(Math.max(1, Math.round(now - lastKeyRef.current)));
    lastKeyRef.current = now;
  }, []);

  const submit = useCallback(async (run: {
    completedCode: string;
    mistakes: number;
    keystrokes: number;
    correctChars: number;
    totalMs: number;
  }) => {
    const session = sessionRef.current;
    if (!session || submittedRef.current === session.sessionId) return;
    submittedRef.current = session.sessionId;
    setStatus("submitting");
    try {
      const result = await submitDailyAttempt({ ...session, ...run, keyIntervals: intervalsRef.current });
      invalidateDailyBoard();
      setOutcome(result);
      setStatus("verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daily score could not be verified.");
      setStatus("rejected");
    }
  }, []);

  const exit = useCallback(() => {
    snippetRef.current = null;
    sessionRef.current = null;
    setActive(false);
    setStatus("idle");
    setChallenge(null);
    setError(null);
    setOutcome(null);
  }, []);

  return { active, status, challenge, error, outcome, snippetRef, enter, retry: openAttempt, recordKeypress, submit, exit };
}
