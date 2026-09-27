/**
 * Kap listens to the app through window events, so the typing screen and the
 * results screen can talk to whichever Kap is on screen without wiring props.
 */

export const KAP_EVENT = "codey:kap";

export type CelebrationLevel = "pb" | "good" | "finish";

export type KapEvent =
  | { type: "key"; error: boolean }
  | { type: "celebrate"; level: CelebrationLevel };

export function emitKap(event: KapEvent) {
  window.dispatchEvent(new CustomEvent<KapEvent>(KAP_EVENT, { detail: event }));
}

/** How loudly Kap cheers a finished run. */
export function celebrationFor(run: { wpm: number; accuracy: number }, previousBestWpm: number | null, custom = false): CelebrationLevel {
  if (!custom && (previousBestWpm === null || run.wpm > previousBestWpm)) return "pb";
  if (run.accuracy >= 97) return "good";
  return "finish";
}

/** What Kap says on the results screen. */
export function celebrationLine(level: CelebrationLevel, run: { wpm: number; accuracy: number }): string {
  if (level === "pb") return "New personal best! Look at that flame!";
  if (level === "good") return `Clean run: ${run.accuracy.toFixed(1)}% accuracy.`;
  if (run.accuracy < 90) return "Nice finish. Slow down a little, accuracy comes first.";
  return "Nice finish! One more?";
}
