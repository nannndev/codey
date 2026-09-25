import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Keyboard, Paintbrush, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "./PreferencesProvider";
import { KEYBOARD_ROWS, Keyboard3D } from "./Keyboard3D";
import {
  EDITOR_KEYCAPS,
  KEYCAP_COLORWAYS,
  getColorway,
  keyRole,
  resolveKeyColors,
  type KeyColors,
  type KeyRole,
  type KeycapOverrides,
} from "@/lib/keycaps";
import { cn } from "@/lib/utils";

export const OPEN_KEYCAP_STUDIO_EVENT = "codey:open-keycap-studio";

export function openKeycapStudio() {
  window.dispatchEvent(new Event(OPEN_KEYCAP_STUDIO_EVENT));
}

const ALL_KEYS = KEYBOARD_ROWS.flat().map((key) => key.id);
const QUICK_COLORS = ["#1b1c1f", "#f4f1e6", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#78716c", "#ffffff"];
const FALLBACK: KeyColors = { cap: "#3a3d45", legend: "#e6e6e6" };

const GROUPS: Array<{ label: string; role?: KeyRole }> = [
  { label: "All" },
  { label: "Letters & symbols", role: "alpha" },
  { label: "Modifiers", role: "mod" },
  { label: "Accent", role: "accent" },
];

export function KeycapStudioModal() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { preferences, setPreference } = usePreferences();

  const colorway = getColorway(preferences.keycapTheme);
  const overrides = preferences.keycapOverrides;
  const paintedCount = Object.keys(overrides).length;

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_KEYCAP_STUDIO_EVENT, show);
    return () => window.removeEventListener(OPEN_KEYCAP_STUDIO_EVENT, show);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Pickers show the first selected key's current colors.
  const current = useMemo<KeyColors>(() => {
    const first = selected.values().next().value;
    if (!first) return FALLBACK;
    const colors = resolveKeyColors(first, colorway, overrides);
    return { cap: colors.cap ?? FALLBACK.cap, legend: colors.legend ?? FALLBACK.legend };
  }, [selected, colorway, overrides]);

  if (!open) return null;

  const toggleKey = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (role?: KeyRole) => {
    setSelected(new Set(role ? ALL_KEYS.filter((id) => keyRole(id) === role) : ALL_KEYS));
  };

  const paint = (field: keyof KeyColors, color: string) => {
    if (selected.size === 0) return;
    const next: KeycapOverrides = { ...overrides };
    selected.forEach((id) => { next[id] = { ...next[id], [field]: color }; });
    setPreference("keycapOverrides", next);
  };

  const resetSelected = () => {
    const next: KeycapOverrides = { ...overrides };
    selected.forEach((id) => { delete next[id]; });
    setPreference("keycapOverrides", next);
  };

  const hasSelection = selected.size > 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Keycap Studio"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in space-y-5">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="size-6 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg tracking-tight text-foreground">Keycap Studio</h3>
              <p className="text-xs text-muted-foreground">Pick a colorway, then click any keys to paint them your way.</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close Keycap Studio"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60 bg-muted/30 pt-4">
          <Keyboard3D interactive active={false} selected={selected} onKeyClick={toggleKey} />
        </div>

        <section className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Colorway</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ColorwayButton
              name="Editor theme"
              chips={["var(--color-muted)", "var(--color-foreground)", "var(--color-primary)"]}
              active={preferences.keycapTheme === EDITOR_KEYCAPS}
              onClick={() => setPreference("keycapTheme", EDITOR_KEYCAPS)}
            />
            {KEYCAP_COLORWAYS.map((option) => (
              <ColorwayButton
                key={option.id}
                name={option.name}
                chips={[option.alpha.cap, option.mod.cap, option.accent.cap]}
                active={preferences.keycapTheme === option.id}
                onClick={() => setPreference("keycapTheme", option.id)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Paintbrush className="size-3.5" /> Paint keys
            </h4>
            <span className="text-[11px] font-medium text-muted-foreground">
              {hasSelection ? `${selected.size} selected` : "Click keys above to select"} · {paintedCount} painted
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((group) => (
              <Button key={group.label} type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => selectGroup(group.role)}>
                {group.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setSelected(new Set())} disabled={!hasSelection}>
              Clear selection
            </Button>
          </div>

          <div className={cn("grid gap-4 sm:grid-cols-2", !hasSelection && "pointer-events-none opacity-50")}>
            <ColorField label="Keycap" value={current.cap} onChange={(color) => paint("cap", color)} />
            <ColorField label="Legend" value={current.legend} onChange={(color) => paint("legend", color)} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetSelected} disabled={!hasSelection}>
              <Eraser className="mr-1 size-3.5" /> Reset selected
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreference("keycapOverrides", {})} disabled={paintedCount === 0}>
              <RotateCcw className="mr-1 size-3.5" /> Reset all paint
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ColorwayButton({ name, chips, active, onClick }: { name: string; chips: string[]; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
        active ? "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/40" : "border-border/60 hover:border-foreground/30",
      )}
    >
      <span className="flex shrink-0 -space-x-1.5">
        {chips.map((color, index) => (
          <span key={index} className="size-5 rounded-md border border-black/15 shadow-xs" style={{ background: color }} />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{name}</span>
      {active && <Check className="size-3.5 shrink-0 text-amber-500" />}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        {label}
        <span className="font-mono text-[11px] font-normal text-muted-foreground">{value}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`${label} ${color}`}
            className={cn("size-5 rounded-md border border-black/15 transition-transform hover:scale-110", value === color && "ring-2 ring-amber-500 ring-offset-1 ring-offset-card")}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}
