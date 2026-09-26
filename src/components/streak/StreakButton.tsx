import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useStreak } from "@/hooks/useStreak";
import { KapMascot } from "./KapMascot";
import { StreakPanel } from "./StreakPanel";

/** Kap in the header: the streak at a glance, the full panel on click. */
export function StreakButton() {
  const status = useStreak();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = status.mood === "risk"
    ? `${status.current}-day streak, practice today to keep it`
    : status.current > 0 ? `${status.current}-day streak` : "No streak yet";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={cn(
          "relative flex h-8 items-center gap-0.5 rounded-lg pl-0.5 pr-2 text-xs font-black tabular-nums transition-colors cursor-pointer hover:bg-muted",
          status.mood === "lit" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <KapMascot mood={status.mood} tier={status.tier} size={26} animate={status.mood === "risk"} className="-mt-1" />
        <span>{status.current}</span>
        {status.mood === "risk" && (
          <span className="absolute right-1 top-1 flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Streak" className="fixed inset-x-3 top-20 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border bg-popover p-3 text-popover-foreground shadow-2xl animate-scale-in sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:max-h-none sm:overflow-visible">
          <StreakPanel status={status} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
