import { useState } from "react";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { useInstallApp } from "@/hooks/useInstallApp";

/** Settings card: install Codey as an app, or how to on iOS. */
export function InstallAppCard() {
  const { state, install } = useInstallApp();
  const [busy, setBusy] = useState(false);

  const detail = {
    installed: "Codey is installed on this device. It opens in its own window and works offline.",
    available: "Open Codey from your home screen or dock, in its own window. Practice works offline too.",
    ios: "In Safari, tap Share, then Add to Home Screen. Practice works offline too.",
    unsupported: "Your browser can install Codey from its menu (Install app, or Add to Home Screen). Practice works offline.",
  }[state];

  return (
    <div className="glass-card flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
        <Smartphone className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">Codey app</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      {state === "available" && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await install();
            } finally {
              setBusy(false);
            }
          }}
          className="flex h-9 items-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
        >
          <Download className="size-3.5" /> Install
        </button>
      )}
      {state === "installed" && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
          <Check className="size-3.5" /> Installed
        </span>
      )}
      {state === "ios" && <Share className="size-4 text-muted-foreground" />}
    </div>
  );
}
