import { useEffect, useMemo, useRef, useState } from "react";
import { normalizePhysicalKey } from "@/utils/keyboard-analytics";
import { KEYBOARD_ROWS, keysForChar } from "@/lib/keyboard-layout";

export { KEYBOARD_ROWS, keysForChar };
import { cn } from "@/lib/utils";
import { usePreferences } from "./PreferencesProvider";
import { getColorway, resolveKeyColors } from "@/lib/keycaps";

interface Keyboard3DProps {
  /** The next character the snippet expects; its keys get a hint glow. */
  nextChar?: string;
  /** Only react to keys (hints, error flashes) while the typing area is live. */
  active: boolean;
  combo?: number;
  className?: string;
  /** Studio mode: keys are clickable and the board sits flatter. */
  interactive?: boolean;
  selected?: ReadonlySet<string>;
  onKeyClick?: (id: string, event: React.MouseEvent) => void;
}

const ERROR_FLASH_MS = 260;

export function Keyboard3D({ nextChar, active, combo = 0, className, interactive = false, selected, onKeyClick }: Keyboard3DProps) {
  const { preferences } = usePreferences();
  const colorway = getColorway(preferences.keycapTheme);
  const overrides = preferences.keycapOverrides;
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [errored, setErrored] = useState<Set<string>>(() => new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const nextCharRef = useRef(nextChar);
  const activeRef = useRef(active);
  nextCharRef.current = nextChar;
  activeRef.current = active;

  useEffect(() => {
    const timers = new Set<number>();
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || !!el.closest?.('[role="dialog"]'));
    };

    // Capture phase runs before React's handlers update the snippet, so
    // nextCharRef still holds the character this keystroke was aimed at.
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return;
      const id = normalizePhysicalKey(event.code, event.key, event.location);
      if (!id) return;
      setPressed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

      const expected = nextCharRef.current;
      if (!activeRef.current || event.repeat || event.ctrlKey || event.metaKey || event.altKey || expected === undefined) return;
      const typed = event.key === "Enter" ? "\n" : event.key.length === 1 ? event.key : null;
      // Tab fills indentation, so it is right whenever whitespace is expected.
      const tabOk = event.key === "Tab" && (expected === " " || expected === "\t");
      if (typed === null || typed === expected || tabOk) return;
      setErrored((prev) => new Set(prev).add(id));
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setErrored((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, ERROR_FLASH_MS);
      timers.add(timer);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const id = normalizePhysicalKey(event.code, event.key, event.location);
      if (!id) return;
      setPressed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    // Keyups are lost when focus leaves the window mid-press.
    const clear = () => setPressed(new Set());

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", clear);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Pointer parallax: tilt toward the cursor. Written straight to CSS
  // variables so mouse movement never re-renders the keycaps.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || interactive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = board.getBoundingClientRect();
        const x = (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
        const y = (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
        board.style.setProperty("--kb-tilt-y", `${Math.max(-1, Math.min(1, x)) * 7}deg`);
        board.style.setProperty("--kb-tilt-x", `${Math.max(-1, Math.min(1, y)) * -4}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [interactive]);

  const hinted = useMemo(() => new Set(active ? keysForChar(nextChar) : []), [active, nextChar]);
  const glow = Math.min(combo / 60, 1);

  return (
    <div className={cn("kb3d", interactive && "is-interactive", className)} aria-hidden={interactive ? undefined : true}>
      <div
        ref={boardRef}
        className="kb3d-board"
        style={{
          "--kb-glow": glow.toFixed(2),
          ...(colorway && { "--kb-plate": colorway.plate, "--kb-accent": colorway.glow }),
        } as React.CSSProperties}
      >
        <div className="kb3d-plate">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="kb3d-row">
              {row.map((key) => {
                const colors = resolveKeyColors(key.id, colorway, overrides);
                const Tag = interactive ? "button" : "div";
                return (
                <Tag
                  key={key.id}
                  {...(interactive && {
                    type: "button" as const,
                    onClick: (event: React.MouseEvent) => onKeyClick?.(key.id, event),
                    "aria-label": `${key.label || "Space"} key`,
                    "aria-pressed": selected?.has(key.id) ?? false,
                  })}
                  className={cn(
                    "kb3d-key",
                    key.label.length > 1 && "is-mod",
                    pressed.has(key.id) && "is-pressed",
                    hinted.has(key.id) && "is-next",
                    errored.has(key.id) && "is-error",
                    selected?.has(key.id) && "is-selected",
                    (key.id === "F" || key.id === "J") && "is-homing",
                  )}
                  style={{
                    "--w": key.w ?? 1,
                    ...(colors.cap && { "--kc-cap": colors.cap }),
                    ...(colors.legend && { "--kc-legend": colors.legend }),
                  } as React.CSSProperties}
                >
                  <span className="kb3d-cap">
                    {key.shift && <span className="kb3d-shift">{key.shift}</span>}
                    <span className="kb3d-legend">{key.label}</span>
                  </span>
                </Tag>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
