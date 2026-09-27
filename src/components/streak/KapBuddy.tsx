import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GripHorizontal, RotateCcw, X } from "lucide-react";
import { useKapLook } from "@/hooks/useKapLook";
import { useStreak } from "@/hooks/useStreak";
import { BUDDY_EVENT, BUDDY_KEY, placeBuddy, readBuddy, readBuddyPos, writeBuddy, writeBuddyPos, type BuddyPos } from "@/lib/kap-buddy";
import { SYNC_EVENT } from "@/lib/account-sync";
import { FLAME_TIERS } from "@/lib/streak";
import { cn } from "@/lib/utils";
import { Kap3D } from "./Kap3D";

const BOX = { width: 128, height: 162 };
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
/** Hands the keyboard back to the practice screen, so typing carries on after a move. */
const backToTyping = (from: Element) => requestAnimationFrame(() => from.closest<HTMLElement>(".workspace-shell")?.focus({ preventScroll: true }));

/**
 * Kap beside the editor while you practice: nods along, stokes his flame,
 * jumps at typos. The grip on top moves him anywhere; dragging Kap himself
 * still spins him.
 */
export function KapBuddy() {
  const [on, setOn] = useState(readBuddy);
  const [pos, setPos] = useState<BuddyPos | null>(readBuddyPos);
  const [view, setView] = useState(viewport);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const look = useKapLook();
  const status = useStreak();

  useEffect(() => {
    const refresh = () => setOn(readBuddy());
    const onStorage = (event: StorageEvent) => event.key === BUDDY_KEY && refresh();
    const onResize = () => setView(viewport());
    window.addEventListener(BUDDY_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener(BUDDY_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const place = placeBuddy(pos, BOX, view);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { dx: event.clientX - place.left, dy: event.clientY - place.top };
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const next = placeBuddy({ x: (event.clientX - drag.current.dx) / view.width, y: (event.clientY - drag.current.dy) / view.height }, BOX, view);
    setPos({ x: next.left / view.width, y: next.top / view.height });
  };

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    backToTyping(event.currentTarget);
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setPos((current) => {
      writeBuddyPos(current);
      return current;
    });
  }, []);

  if (!on) return null;
  return (
    <div
      className={cn("group fixed z-30 hidden select-none xl:block", dragging && "cursor-grabbing")}
      style={{ left: place.left, top: place.top, width: BOX.width, height: BOX.height }}
    >
      <div className={cn("absolute inset-x-0 top-0 z-10 flex h-6 items-center justify-center gap-1 transition-opacity", dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100")}>
        <button
          type="button"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex h-5 cursor-grab items-center rounded-full border bg-background/85 px-2 text-muted-foreground backdrop-blur hover:text-foreground active:cursor-grabbing touch-none"
          aria-label="Move Kap"
          title="Drag to move Kap"
        >
          <GripHorizontal className="size-3.5" />
        </button>
        {pos && (
          <button
            type="button"
            onClick={(event) => { setPos(null); writeBuddyPos(null); backToTyping(event.currentTarget); }}
            className="grid size-5 place-items-center rounded-full border bg-background/85 text-muted-foreground backdrop-blur hover:text-foreground cursor-pointer"
            aria-label="Put Kap back in the corner"
            title="Back to the corner"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
        <button
          type="button"
          onClick={(event) => { backToTyping(event.currentTarget); writeBuddy(false); }}
          className="grid size-5 place-items-center rounded-full border bg-background/85 text-muted-foreground backdrop-blur hover:text-foreground cursor-pointer"
          aria-label="Hide Kap"
          title="Hide Kap (turn him back on in the Wardrobe)"
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0" style={{ height: BOX.height - 24 }} aria-hidden>
        <Kap3D mood="lit" tier={status.tier ?? FLAME_TIERS[1]} look={look} height={BOX.height - 24} listen fallback={null} />
      </div>
    </div>
  );
}
