import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, WifiOff, X } from "lucide-react";

/**
 * Registers the service worker and applies new versions. A waiting version
 * would otherwise stay parked until every tab closes, so it is applied on its
 * own whenever that cannot cut off a run: right after the page loads, when the
 * tab is hidden, or after a while without typing. The toast lets you reload
 * sooner.
 */

const IDLE_MS = 20_000;
const FRESH_LOAD_MS = 15_000;
let lastKeyAt = 0;
if (typeof window !== "undefined") window.addEventListener("keydown", () => { lastKeyAt = Date.now(); }, { capture: true, passive: true });
export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Long-lived tabs look for a new version every hour.
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      window.setInterval(check, 60 * 60 * 1000);
      // Coming back to a tab left open for days also looks for a new version.
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    },
  });
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh) return;
    const apply = () => void updateServiceWorker(true);
    const safe = () => performance.now() < FRESH_LOAD_MS || document.visibilityState === "hidden" || Date.now() - lastKeyAt > IDLE_MS;
    if (safe()) {
      apply();
      return;
    }
    const timer = window.setInterval(() => safe() && apply(), 5000);
    const onHide = () => document.visibilityState === "hidden" && apply();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 6000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  const toast = "pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 text-sm shadow-xl backdrop-blur";

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {!online && (
        <div className={toast}>
          <WifiOff className="size-4 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-semibold text-foreground">Offline.</span> Practice still works; runs sync when you are back.
          </p>
        </div>
      )}
      {needRefresh && (
        <div className={toast}>
          <RefreshCw className="size-4 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 font-medium">A new version of Codey is ready.</p>
          <button type="button" onClick={() => void updateServiceWorker(true)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400 cursor-pointer">
            Reload
          </button>
          <button type="button" aria-label="Later" onClick={() => setNeedRefresh(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {offlineReady && !needRefresh && (
        <div className={toast}>
          <WifiOff className="size-4 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-semibold text-foreground">Ready offline.</span> Codey now works without a connection.
          </p>
        </div>
      )}
    </div>
  );
}
