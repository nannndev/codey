import { getHistory, getStreak } from "@/utils/storage";
import { getDuelHistory } from "@/utils/duel-history";
import { getVisibleKeyStats } from "@/utils/keyboard-analytics";
import { readStore, syncAchievements, type AchievementSnapshot } from "./achievements";
import { streakFromRuns } from "./run-stats";
import type { CloudRun } from "./cloud";

/** Everything this device knows about the player. */
export function localSnapshot(userId?: string | null): AchievementSnapshot {
  const runs = getHistory().map((run) => ({
    timestamp: run.timestamp,
    wpm: run.wpm,
    accuracy: run.accuracy,
    language: run.language,
    duration: run.duration,
    charsTyped: run.charsTyped,
    maxCombo: run.maxCombo,
  }));
  const duels = getDuelHistory();
  const store = readStore();
  const keystrokes = Object.values(getVisibleKeyStats(userId)).reduce((sum, stat) => sum + (stat.totalPresses || 0), 0);
  return {
    runs,
    bestStreak: Math.max(getStreak().best, streakFromRuns(runs).best),
    keystrokes,
    duelWins: duels.filter((duel) => duel.outcome === "victory").length,
    partyWins: duels.filter((duel) => duel.outcome === "victory" && (duel.playerCount ?? 2) >= 4).length,
    dailyCompleted: store.dailyDates.length,
    rankedVerified: store.rankedSessions.length,
  };
}

/** What another player's synced runs show; device-only sources stay unknown. */
export function cloudSnapshot(runs: CloudRun[]): AchievementSnapshot {
  const mapped = runs.map((run) => ({
    timestamp: new Date(run.$createdAt).getTime(),
    wpm: run.wpm,
    accuracy: run.accuracy,
    language: run.language,
    duration: run.mode === "timed" && run.durationSeconds ? run.durationSeconds * 1000 : run.durationMs,
    charsTyped: run.keystrokes,
  }));
  return { runs: mapped, bestStreak: streakFromRuns(mapped).best, keystrokes: null, duelWins: null, partyWins: null, dailyCompleted: null, rankedVerified: null };
}

/** Re-evaluate after anything that can earn a badge; announces new ones. */
export function checkAchievements(userId?: string | null) {
  try {
    return syncAchievements(localSnapshot(userId));
  } catch (error) {
    console.warn("Achievements check failed", error);
    return [];
  }
}
