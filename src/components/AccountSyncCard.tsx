import { useEffect, useState } from "react";
import { Cloud, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSyncState, subscribeSyncState, syncAccount, type SyncState } from "@/lib/account-sync";
import { formatRelative } from "@/lib/run-stats";
import { cn } from "@/lib/utils";

const SYNCED = ["Runs & stats", "Keyboard analytics", "Achievements", "Streak", "Preferences & theme", "Sounds & radio", "Daily goals", "Duel history", "Arcade high scores"];

/** Shows what follows the account and when it last synced. */
export function AccountSyncCard() {
  const { user, login, configured } = useAuth();
  const [state, setState] = useState<SyncState>(getSyncState);
  useEffect(() => subscribeSyncState(setState), []);

  const Icon = state.status === "syncing" ? LoaderCircle : state.status === "error" ? CloudOff : Cloud;
  return (
    <div className="glass-card rounded-2xl p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4 text-amber-500", state.status === "syncing" && "animate-spin")} />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">Account sync</h2>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => void syncAccount(user.$id)}
            disabled={state.status === "syncing"}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", state.status === "syncing" && "animate-spin")} /> Sync now
          </button>
        )}
      </div>
      {user ? (
        <>
          <p className={cn("text-sm", state.status === "error" && "text-rose-500")}>
            {state.status === "syncing"
              ? "Syncing with your account…"
              : state.status === "error"
                ? `Sync failed: ${state.error ?? "try again"}`
                : state.lastSyncAt
                  ? `Synced ${formatRelative(state.lastSyncAt)}. Everything below follows you to every device.`
                  : "Everything below follows you to every device."}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {SYNCED.map((item) => (
              <li key={item} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{item}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Signed out: your runs and settings stay in this browser only. Sign in to keep them on your account.</p>
          {configured && (
            <button type="button" onClick={login} className="h-8 rounded-lg bg-foreground px-3 text-xs font-semibold text-background cursor-pointer">Sign in</button>
          )}
        </div>
      )}
    </div>
  );
}
