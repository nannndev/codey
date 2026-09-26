import { useEffect, useState } from "react";
import { getHistory, getStreak, STREAK_EVENT } from "@/utils/storage";
import { SYNC_EVENT } from "@/lib/account-sync";
import { dateKey, streakStatus, type StreakStatus } from "@/lib/streak";

function read(): StreakStatus {
  const days = getHistory().map((run) => dateKey(new Date(run.timestamp)));
  return streakStatus(getStreak(), days);
}

/** The streak as Kap sees it, kept fresh after runs, account syncs, other tabs and midnight. */
export function useStreak(): StreakStatus {
  const [status, setStatus] = useState(read);

  useEffect(() => {
    const refresh = () => setStatus(read());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith("codetype_")) refresh();
    };
    window.addEventListener(STREAK_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    // The day can roll over while the tab stays open.
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(STREAK_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  return status;
}
