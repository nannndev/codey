import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { disablePush, enablePush, pushConfig, pushSupported, readPush, type PushPrefs } from "@/lib/push";
import { cn } from "@/lib/utils";

/** Settings: push notifications that arrive even with Codey closed. */
export function PushCard() {
  const { user, login } = useAuth();
  const [prefs, setPrefs] = useState<PushPrefs>(readPush);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return setAvailable(false);
    void pushConfig().then((config) => setAvailable(config.enabled));
  }, []);

  const apply = async (next: Pick<PushPrefs, "streak" | "league">, on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setPrefs(on && (next.streak || next.league) ? await enablePush(next) : await disablePush());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notifications could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const detail = available === false
    ? pushSupported() ? "Push isn't set up on this server yet." : "This browser can't receive push notifications. On iPhone, install Codey to your home screen first."
    : !user ? "Sign in to get reminders, even with Codey closed." : prefs.enabled ? "On for this device." : "Get a nudge on this device, even with Codey closed.";

  return (
    <div className="glass-card rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <BellRing className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">Notifications</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
        {available && (user ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply({ streak: prefs.streak, league: prefs.league }, !prefs.enabled)}
            className={cn("flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer", prefs.enabled ? "border hover:bg-muted" : "bg-amber-500 text-black hover:bg-amber-400")}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />} {prefs.enabled ? "Turn off" : "Turn on"}
          </button>
        ) : (
          <button type="button" onClick={login} className="h-9 rounded-xl border px-4 text-xs font-bold hover:bg-muted cursor-pointer">Sign in</button>
        ))}
      </div>
      {available && user && prefs.enabled && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["streak", "Streak reminder", "Around 7 PM (WIB) when your streak would break tonight."],
            ["league", "League", "When someone passes you in your weekly league."],
          ] as const).map(([key, label, hint]) => (
            <label key={key} className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card/40 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={prefs[key]}
                disabled={busy}
                onChange={(event) => void apply({ ...prefs, [key]: event.target.checked }, true)}
                className="mt-0.5 size-4 accent-amber-500"
              />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
