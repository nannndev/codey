import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Shirt, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLAME_TIERS } from "@/lib/streak";
import { useStreak } from "@/hooks/useStreak";
import { useKapLook } from "@/hooks/useKapLook";
import { earnedBadges, isUnlocked, SLOT_NAMES, toggleItem, unlockHint, WARDROBE, writeLook, type WardrobeItem, type WardrobeSlot } from "@/lib/kap-wardrobe";
import { KapMascot } from "./KapMascot";
import { Kap3D } from "./Kap3D";
import type { KapLook } from "./kap-skins";

export const OPEN_WARDROBE_EVENT = "codey:open-wardrobe";

export function openKapWardrobe() {
  window.dispatchEvent(new Event(OPEN_WARDROBE_EVENT));
}

const SLOTS: WardrobeSlot[] = ["color", "head", "eyes", "wear"];

function lookWith(item: WardrobeItem): KapLook {
  return item.slot === "color" ? { color: item.id as KapLook["color"] } : { [item.slot]: item.id };
}

/** Dress Kap: every unlocked item, and what the locked ones take. Mounted once, opened by event. */
export function KapWardrobe() {
  const [open, setOpen] = useState(false);
  const look = useKapLook();
  const status = useStreak();
  const [earned, setEarned] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const show = () => {
      setEarned(earnedBadges());
      setOpen(true);
    };
    window.addEventListener(OPEN_WARDROBE_EVENT, show);
    return () => window.removeEventListener(OPEN_WARDROBE_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tier = status.tier ?? FLAME_TIERS[1];
  const unlockedCount = useMemo(() => WARDROBE.filter((item) => isUnlocked(item, earned)).length, [earned]);
  if (!open) return null;

  const worn = (item: WardrobeItem) => (look as Record<string, string | null | undefined>)[item.slot] === item.id || (item.slot === "color" && !look.color && item.id === "amber");

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Kap's wardrobe" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onKeyDown={(event) => event.stopPropagation()}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl animate-scale-in sm:flex-row">
        <div className="relative flex shrink-0 flex-col items-center justify-center gap-2 border-b bg-gradient-to-b from-amber-500/15 to-transparent px-6 py-5 sm:w-64 sm:border-b-0 sm:border-r">
          <div className="pointer-events-none absolute left-1/2 top-10 size-40 -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: tier.flame }} aria-hidden />
          <Kap3D mood="lit" tier={tier} look={look} height={190} className="relative w-full" fallback={<KapMascot mood="lit" tier={tier} size={150} look={look} title="Kap in your look" />} />
          <p className="relative -mt-1 text-[10px] text-muted-foreground">Drag to spin · tap to hop</p>
          <p className="relative text-sm font-black tracking-tight">Kap's wardrobe</p>
          <p className="relative text-xs text-muted-foreground">{unlockedCount} of {WARDROBE.length} unlocked</p>
          <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${(unlockedCount / WARDROBE.length) * 100}%` }} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Shirt className="size-4 text-amber-500" /> Dress Kap</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {SLOTS.map((slot) => (
            <section key={slot} className="mb-4 last:mb-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{SLOT_NAMES[slot]}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {WARDROBE.filter((item) => item.slot === slot).map((item) => {
                  const unlocked = isUnlocked(item, earned);
                  const on = unlocked && worn(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => writeLook(toggleItem(look, item))}
                      title={unlocked ? (on && slot !== "color" ? `Take off ${item.name}` : `Wear ${item.name}`) : `Locked: ${unlockHint(item)}`}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border px-1.5 pb-2 pt-1.5 text-center transition-colors",
                        unlocked ? "cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/5" : "cursor-not-allowed bg-muted/30",
                        on && "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40",
                      )}
                    >
                      <span className={cn(!unlocked && "opacity-35 grayscale")}>
                        <KapMascot mood="lit" tier={tier} size={64} animate={false} look={lookWith(item)} />
                      </span>
                      <span className="mt-0.5 text-[11px] font-semibold leading-tight">{item.name}</span>
                      {!unlocked && <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">{unlockHint(item)}</span>}
                      {on && <Check className="absolute right-1.5 top-1.5 size-3.5 text-amber-500" strokeWidth={3} />}
                      {!unlocked && <Lock className="absolute right-1.5 top-1.5 size-3 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="mt-2 text-[11px] text-muted-foreground">Items unlock with achievements. Your look syncs to your account and shows wherever Kap does.</p>
        </div>
      </div>
    </div>
  );
}
