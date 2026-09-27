import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useKapLook } from "@/hooks/useKapLook";
import { useStreak } from "@/hooks/useStreak";
import { BUDDY_EVENT, BUDDY_KEY, readBuddy, writeBuddy } from "@/lib/kap-buddy";
import { SYNC_EVENT } from "@/lib/account-sync";
import { FLAME_TIERS } from "@/lib/streak";
import { Kap3D } from "./Kap3D";

/** Kap in the corner while you practice: nods along, stokes his flame, jumps at typos. */
export function KapBuddy() {
  const [on, setOn] = useState(readBuddy);
  const look = useKapLook();
  const status = useStreak();

  useEffect(() => {
    const refresh = () => setOn(readBuddy());
    const onStorage = (event: StorageEvent) => event.key === BUDDY_KEY && refresh();
    window.addEventListener(BUDDY_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(BUDDY_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!on) return null;
  return (
    <div className="group fixed bottom-3 left-3 z-30 hidden w-32 select-none xl:block" aria-hidden>
      <Kap3D mood="lit" tier={status.tier ?? FLAME_TIERS[1]} look={look} height={138} listen fallback={null} />
      <button
        type="button"
        onClick={() => writeBuddy(false)}
        className="absolute right-1 top-1 rounded-full border bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 cursor-pointer"
        aria-label="Hide Kap"
        title="Hide Kap (turn him back on in the Wardrobe)"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
