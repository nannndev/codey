import { useEffect, useState } from "react";
import { ACHIEVEMENT_EVENT, evaluate, readStore, type Evaluation } from "@/lib/achievements";
import { localSnapshot, publicSnapshot, syncAchievementsForAccount } from "@/lib/achievement-snapshot";
import type { CloudRun } from "@/lib/cloud";

export interface AchievementsView {
  evaluation: Evaluation;
  unlockedAt: Record<string, number>;
  /** True while cloud data for this view is still loading. */
  syncing: boolean;
}

/**
 * Your own badges (device + account, synced on mount) or another player's
 * (from their verified cloud data). Re-evaluates when a badge unlocks.
 */
export function useAchievements(options: { userId?: string | null; own: boolean; runs?: CloudRun[] }): AchievementsView {
  const { userId, own, runs } = options;
  const [view, setView] = useState<AchievementsView>(() => ({
    evaluation: evaluate(own ? localSnapshot(userId) : { runs: [], bestStreak: 0, keystrokes: null, duelWins: null, partyWins: null, dailyCompleted: null, rankedVerified: null }),
    unlockedAt: own ? readStore().unlockedAt : {},
    syncing: Boolean(userId),
  }));

  useEffect(() => {
    let cancelled = false;
    const refreshOwn = () => !cancelled && setView({ evaluation: evaluate(localSnapshot(userId)), unlockedAt: readStore().unlockedAt, syncing: false });
    if (own) {
      refreshOwn();
      if (userId) void syncAchievementsForAccount(userId).then(refreshOwn);
      window.addEventListener(ACHIEVEMENT_EVENT, refreshOwn);
      return () => {
        cancelled = true;
        window.removeEventListener(ACHIEVEMENT_EVENT, refreshOwn);
      };
    }
    if (userId && runs) {
      void publicSnapshot(userId, runs).then((snapshot) => !cancelled && setView({ evaluation: evaluate(snapshot), unlockedAt: {}, syncing: false }));
    }
    return () => {
      cancelled = true;
    };
  }, [own, userId, runs]);

  return view;
}
