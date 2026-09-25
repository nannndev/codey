import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, ExternalLink, FileCode2, Flame, GitBranch, GitPullRequest, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePreferences } from "@/components/PreferencesProvider";
import type { CharState } from "@/types";
import { tokenizeCode, type SyntaxToken } from "@/utils/syntax";
import { SparkCanvas, type SparkCanvasHandle } from "./SparkCanvas";
import { playComboMilestoneSound, playComboLostSound } from "@/utils/combo-audio";

interface CodeDisplayProps {
  chars: CharState[];
  filename: string;
  language: string;
  source?: { repo: string; url: string };
  input: string;
  onClick: () => void;
  focusMode?: boolean;
  onFocusModeChange?: (active: boolean) => void;
  focusStats?: { wpm: number; accuracy: number; time: string };
  onRestart?: () => void;
  isRunning?: boolean;
  ghostCharIndex?: number | null;
  ghostWpm?: number | null;
  combo?: number;
  maxCombo?: number;
}

type CursorPref = "block" | "underline" | "line";

function BlockCursor({ char }: { char: string; syntax: SyntaxToken }) {
  return (
    <span className="rounded-[2px] bg-primary !text-primary-foreground font-black px-[1px] shadow-xs">
      {char === "\n" ? "↵\n" : char}
    </span>
  );
}

function UnderlineCursor({ char, syntax }: { char: string; syntax: SyntaxToken }) {
  return (
    <span className={cn("border-b-[3px] border-primary pb-0.5 font-bold", `syntax-${syntax}`)}>
      {char === "\n" ? "↵\n" : char}
    </span>
  );
}

function LineCursor({ char, syntax }: { char: string; syntax: SyntaxToken }) {
  return (
    <span className="relative">
      <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-primary animate-[blink_1s_step-end_infinite] rounded-full shadow-[0_0_8px_var(--color-primary)]" />
      <span className={cn("pl-[3px]", `syntax-${syntax}`)}>{char === "\n" ? "↵\n" : char}</span>
    </span>
  );
}

const CURSOR_COMPONENTS: Record<CursorPref, React.FC<{ char: string; syntax: SyntaxToken }>> = {
  block: BlockCursor,
  underline: UnderlineCursor,
  line: LineCursor,
};

export function CodeDisplay({
  chars,
  filename,
  language,
  source,
  input,
  onClick,
  focusMode = false,
  onFocusModeChange,
  focusStats,
  onRestart,
  isRunning = false,
  ghostCharIndex = null,
  ghostWpm = null,
  combo = 0,
  maxCombo: _maxCombo = 0,
}: CodeDisplayProps) {
  const { preferences, setPreference } = usePreferences();
  const cursorStyle = preferences.cursorStyle as CursorPref;
  const CursorComponent = CURSOR_COMPONENTS[cursorStyle];
  const fontSizes = ["12", "14", "16", "18", "20", "22", "24"] as const;
  const fontIndex = fontSizes.indexOf(preferences.fontSize);
  const syntaxTokens = useMemo(() => tokenizeCode(chars.map((char) => char.char).join("")), [chars]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const sparkCanvasRef = useRef<SparkCanvasHandle>(null);
  const prevInputLenRef = useRef(input.length);
  const prevComboRef = useRef(combo);
  const [justLostCombo, setJustLostCombo] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  /** Lines where a mistake happened this run, even if later corrected. */
  const errorLinesRef = useRef(new Set<number>());
  const [strikeId, setStrikeId] = useState(0);
  const [perfectLine, setPerfectLine] = useState<{ line: number; id: number } | null>(null);
  const [strikeBanner, setStrikeBanner] = useState<{ text: string; tier: "flow" | "fever" | "overdrive"; id: number } | null>(null);

  const strikeFull = preferences.strikeIntensity === "full";
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cursorPoint = () => {
    if (!cursorRef.current || !viewportRef.current) return null;
    const cursorRect = cursorRef.current.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    return {
      x: cursorRect.left - viewportRect.left,
      y: cursorRect.top - viewportRect.top + cursorRect.height / 2,
    };
  };

  /** Tiny editor shake via the Web Animations API, so it never re-renders. */
  const shakeWindow = (amplitude: number, duration: number) => {
    const el = windowRef.current;
    if (!el || reducedMotion || !strikeFull || typeof el.animate !== "function") return;
    el.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${-amplitude}px, ${amplitude * 0.5}px, 0)` },
        { transform: `translate3d(${amplitude}px, ${-amplitude * 0.4}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      { duration, easing: "ease-out" },
    );
  };

  const lineOf = (index: number) => {
    let line = 0;
    for (let i = 0; i < index && i < chars.length; i++) if (chars[i].char === "\n") line++;
    return line;
  };

  // Per-keystroke strike: particles and ring at the cursor, a miss burst on
  // wrong keys, impact shake at high combos, and "perfect line" when a line
  // is finished without any mistakes.
  useEffect(() => {
    const previous = prevInputLenRef.current;
    prevInputLenRef.current = input.length;
    if (input.length === 0) errorLinesRef.current.clear();
    if (!preferences.comboEffects || input.length <= previous) return;

    const lastIndex = input.length - 1;
    const last = chars[lastIndex];
    const point = cursorPoint();

    if (last?.status === "incorrect") {
      errorLinesRef.current.add(lineOf(lastIndex));
      if (point) sparkCanvasRef.current?.miss(point.x, point.y);
      shakeWindow(3, 180);
    } else {
      if (point) sparkCanvasRef.current?.spawn(point.x, point.y, combo);
      if (combo >= 100) shakeWindow(2.2, 110);
      else if (combo >= 50) shakeWindow(1.2, 90);
    }
    setStrikeId((id) => id + 1);

    // A correct newline in this keystroke closes a line.
    for (let i = previous; i < input.length; i++) {
      if (chars[i]?.char !== "\n" || chars[i].status !== "correct") continue;
      const line = lineOf(i);
      const lineChars = lines[line] ?? [];
      const meaningful = lineChars.filter(({ state }) => state.char.trim() !== "").length;
      if (meaningful >= 3 && !errorLinesRef.current.has(line)) {
        setPerfectLine({ line, id: Date.now() });
      }
    }
    // Refs and helpers are read at keystroke time; input drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (!preferences.comboEffects) return;

    if (combo > prevComboRef.current) {
      if (combo === 25 || combo === 50 || combo === 100 || (combo > 100 && combo % 50 === 0)) {
        playComboMilestoneSound(combo, preferences.keyboardSoundVolume);
        setStrikeBanner({
          text: combo === 25 ? "25 Strike!" : combo === 50 ? "Fever ×50" : combo === 100 ? "Overdrive ×100" : `Unstoppable ×${combo}`,
          tier: combo >= 100 ? "overdrive" : combo >= 50 ? "fever" : "flow",
          id: combo,
        });
        shakeWindow(combo >= 100 ? 4 : 3, 260);
        if (cursorRef.current && viewportRef.current && sparkCanvasRef.current) {
          const cursorRect = cursorRef.current.getBoundingClientRect();
          const viewportRect = viewportRef.current.getBoundingClientRect();
          const x = cursorRect.left - viewportRect.left + cursorRect.width / 2;
          const y = cursorRect.top - viewportRect.top + cursorRect.height / 2;
          sparkCanvasRef.current.burst(x, y, combo);
        }
      }
    } else if (prevComboRef.current >= 20 && combo === 0) {
      playComboLostSound(preferences.keyboardSoundVolume);
      setJustLostCombo(true);
      const timer = setTimeout(() => setJustLostCombo(false), 300);
      return () => clearTimeout(timer);
    }
    prevComboRef.current = combo;
  }, [combo, preferences.comboEffects, preferences.keyboardSoundVolume]);

  const comboTierClass =
    !preferences.comboEffects || combo < 20
      ? ""
      : combo >= 100
      ? "combo-glow-overdrive"
      : combo >= 50
      ? "combo-glow-fever"
      : "combo-glow-flow";

  const toggleFocusMode = () => {
    const update = () => onFocusModeChange?.(!focusMode);
    const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (transitionDocument.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      transitionDocument.startViewTransition(update);
    } else {
      update();
    }
  };

  const lines = useMemo(() => {
    const result: Array<Array<{ state: CharState; syntax: SyntaxToken; globalIndex: number }>> = [];
    let current: Array<{ state: CharState; syntax: SyntaxToken; globalIndex: number }> = [];
    chars.forEach((state, index) => {
      current.push({ state, syntax: syntaxTokens[index], globalIndex: index });
      if (state.char === "\n") {
        result.push(current);
        current = [];
      }
    });
    if (current.length > 0) result.push(current);
    return result;
  }, [chars, syntaxTokens]);

  const currentLineIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i].isCurrent) return count;
      if (chars[i].char === "\n") count++;
    }
    return -1;
  }, [chars]);

  const cursorCol = useMemo(() => {
    let lastNewline = -1;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === "\n") lastNewline = i;
    }
    return input.length - lastNewline;
  }, [input]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const cursor = cursorRef.current;
    if (!viewport || !cursor) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    const verticalPadding = Math.min(120, viewport.clientHeight * 0.32);
    const horizontalPadding = Math.min(180, viewport.clientWidth * 0.25);

    let top = viewport.scrollTop;
    let left = viewport.scrollLeft;
    if (cursorRect.top < viewportRect.top + verticalPadding) {
      top -= viewportRect.top + verticalPadding - cursorRect.top;
    } else if (cursorRect.bottom > viewportRect.bottom - verticalPadding) {
      top += cursorRect.bottom - (viewportRect.bottom - verticalPadding);
    }
    if (cursorRect.left < viewportRect.left + horizontalPadding) {
      left -= viewportRect.left + horizontalPadding - cursorRect.left;
    } else if (cursorRect.right > viewportRect.right - horizontalPadding) {
      left += cursorRect.right - (viewportRect.right - horizontalPadding);
    }

    viewport.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "instant" });
  }, [input, preferences.fontSize]);

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [focusMode]);

  const centerCursor = () => {
    cursorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    onClick();
  };

  const restartFromChrome = () => {
    if (isRunning && !window.confirm("Restart this typing run? Current progress will be lost.")) return;
    onRestart?.();
  };

  const showGhost = preferences.ghostRunner && ghostCharIndex !== null && ghostCharIndex >= 0 && (ghostWpm ?? 0) > 0;
  const effectiveGhostIndex = showGhost ? Math.min(chars.length - 1, ghostCharIndex) : -1;

  return (
    <div
      ref={windowRef}
      className={cn(
        "code-window relative overflow-hidden rounded-2xl border border-border/80 shadow-2xl focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:ring-offset-2 focus-within:ring-offset-background transition-all duration-300",
        focusMode && "code-window-focus",
        comboTierClass,
        justLostCombo && "combo-shake"
      )}
      onClick={onClick}
      tabIndex={0}
    >
      {/* Floating Combo Badge */}
      {preferences.comboEffects && combo >= 10 && (
        <div
          key={combo}
          className={cn(
            "absolute top-2.5 right-12 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-black shadow-lg backdrop-blur-md pointer-events-none combo-badge-pop select-none",
            combo >= 100
              ? "bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white border border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
              : combo >= 50
              ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          )}
        >
          <span className="text-sm">
            {combo >= 100 ? "⚡" : combo >= 50 ? "🔥" : "✨"}
          </span>
          <span>
            {combo}x {combo >= 100 ? "OVERDRIVE" : combo >= 50 ? "FEVER" : "STREAK"}
          </span>
        </div>
      )}

      {strikeBanner && preferences.comboEffects && (
        <div
          key={strikeBanner.id}
          // Sits in the title bar, never over the code being typed.
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[52px] items-center justify-center select-none"
          aria-hidden="true"
        >
          <span className={cn("strike-banner", `is-${strikeBanner.tier}`)} onAnimationEnd={() => setStrikeBanner(null)}>
            {strikeBanner.text}
          </span>
        </div>
      )}

      {/* Modern Editor Title bar / Tabs */}
      <div className="code-chrome flex items-center justify-between border-b border-border/70 px-4 py-2.5 select-none bg-muted/40 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          {/* macOS window controls */}
          <div className="editor-window-actions flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={restartFromChrome}
              className="editor-window-dot size-3 rounded-full bg-rose-500/80 hover:bg-rose-500 hover:shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-all"
              aria-label="Restart typing run"
              title="Restart run"
            >
              <span>×</span>
            </button>
            <button
              type="button"
              onClick={centerCursor}
              className="editor-window-dot size-3 rounded-full bg-amber-400/80 hover:bg-amber-400 hover:shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-all"
              aria-label="Center active cursor"
              title="Center active cursor"
            >
              <span>−</span>
            </button>
            <button
              type="button"
              onClick={toggleFocusMode}
              className="editor-window-dot size-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] transition-all"
              aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
              title={focusMode ? "Exit focus mode" : "Focus mode"}
            >
              <span>{focusMode ? "−" : "+"}</span>
            </button>
          </div>

          {/* Active File Tab */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-background/60 border border-border/50 text-xs font-mono min-w-0 shadow-xs">
            {language.toLowerCase() === "diff" ? (
              <GitPullRequest aria-hidden="true" className="size-3.5 text-emerald-500 shrink-0" />
            ) : (
              <FileCode2 aria-hidden="true" className="size-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate font-semibold text-foreground/90">{filename}</span>
            <Badge
              variant="secondary"
              className={cn(
                "text-[9px] font-mono px-1.5 py-0 rounded-md shrink-0",
                language.toLowerCase() === "diff"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {language}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {focusMode && focusStats && (
            <div className="hidden items-center gap-3 border-l border-border/50 pl-3 text-[11px] font-mono tabular-nums text-muted-foreground sm:flex">
              <span><strong className="text-foreground">{focusStats.wpm.toFixed(1)}</strong> WPM</span>
              <span><strong className="text-foreground">{focusStats.accuracy.toFixed(1)}%</strong> ACC</span>
              <span>{focusStats.time}</span>
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreference("comboEffects", !preferences.comboEffects);
            }}
            className={cn(
              "grid size-7 place-items-center rounded-lg transition-colors cursor-pointer",
              preferences.comboEffects
                ? "text-amber-500 hover:bg-amber-500/15"
                : "text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
            )}
            aria-label="Toggle Combo Sparks and Screen Glow"
            title={preferences.comboEffects ? "Combo Sparks & Glow: ON (Click to disable)" : "Combo Sparks & Glow: OFF (Click to enable)"}
          >
            <Flame className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFocusMode();
            }}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label={focusMode ? "Exit focus mode" : "Expand editor to focus mode"}
            title={focusMode ? "Exit focus mode (Esc)" : "Focus mode"}
          >
            {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Code viewport */}
      <div ref={viewportRef} className="code-viewport relative min-w-0 overflow-auto py-5">
        <SparkCanvas ref={sparkCanvasRef} disabled={!preferences.comboEffects} intensity={preferences.strikeIntensity} />
        <div className="min-w-max">
          {lines.map((line, li) => {
            const lineStr = line.map((item) => item.state.char).join("");
            const isDiffAdd = lineStr.startsWith("+");
            const isDiffDel = lineStr.startsWith("-");
            const isDiffHunk = lineStr.startsWith("@@");

            return (
              <div
                key={li}
                className={cn(
                  "code-row relative",
                  li === currentLineIndex && "is-current-line",
                  isDiffAdd && "git-diff-add",
                  isDiffDel && "git-diff-del",
                  isDiffHunk && "git-diff-hunk"
                )}
              >
              <span className={cn("code-line-number", li === currentLineIndex && "is-current text-amber-500 font-bold")}>
                {li + 1}
              </span>
              {perfectLine?.line === li && preferences.comboEffects && (
                <span
                  key={perfectLine.id}
                  className="perfect-sweep pointer-events-none"
                  onAnimationEnd={() => setPerfectLine(null)}
                  aria-hidden="true"
                >
                  <span className="perfect-tag">Perfect</span>
                </span>
              )}
              <div className="whitespace-pre px-4">
                {line.map(({ state: c, syntax, globalIndex }, ci) => {
                  const isGhostHere = showGhost && globalIndex === effectiveGhostIndex;
                  // Whitespace is skipped: inline-block on a newline would break the line.
                  const isStruck = preferences.comboEffects && strikeId > 0 && globalIndex === input.length - 1 && c.char.trim() !== "";

                  if (c.isCurrent) {
                    return (
                      <span ref={cursorRef} key={`${li}-${ci}`} className="inline-block relative">
                        {isGhostHere && (
                          <span
                            className="absolute -top-3.5 left-0 z-20 flex items-center gap-0.5 rounded-xs bg-purple-950/80 dark:bg-purple-900/80 border border-purple-500/40 px-1 py-0 text-[8px] font-medium text-purple-300 pointer-events-none backdrop-blur-xs select-none"
                            title={`Ghost PB Pace: ${ghostWpm ? `${ghostWpm.toFixed(0)} WPM` : ""}`}
                          >
                            <span>👻</span>
                            <span>PB</span>
                          </span>
                        )}
                        <CursorComponent char={c.char} syntax={syntax} />
                      </span>
                    );
                  }

                  return (
                    <span
                      // Re-keyed on each keystroke so the strike animation replays.
                      key={isStruck ? `${li}-${ci}-s${strikeId}` : `${li}-${ci}`}
                      className={cn(
                        "syntax-char transition-all duration-100 relative",
                        isStruck && (c.status === "incorrect" ? "is-strike-miss" : "is-strike"),
                        `syntax-${syntax}`,
                        c.status === "correct" && "is-typed",
                        c.status === "incorrect" && "is-error",
                        c.status === "pending" && "is-pending",
                        isGhostHere && "bg-purple-500/15 border-b-2 border-purple-400/60 text-purple-300 dark:text-purple-200 rounded-xs",
                      )}
                    >
                      {isGhostHere && (
                        <span
                          className="absolute -top-3.5 left-0 z-20 flex items-center gap-0.5 rounded-xs bg-purple-950/80 dark:bg-purple-900/80 border border-purple-500/40 px-1 py-0 text-[8px] font-medium text-purple-300 pointer-events-none backdrop-blur-xs select-none"
                          title={`Ghost PB Pace: ${ghostWpm ? `${ghostWpm.toFixed(0)} WPM` : ""}`}
                        >
                          <span>👻</span>
                          <span>PB</span>
                        </span>
                      )}
                      {c.char}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Status telemetry bar */}
      <div className="code-chrome flex items-center justify-between gap-4 border-t border-border/70 px-4 py-2 text-[11px] font-mono text-muted-foreground select-none bg-muted/30">
        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-1.5 hover:text-foreground transition-colors font-sans"
            onClick={(event) => event.stopPropagation()}
          >
            <GitBranch aria-hidden="true" className="size-3 text-amber-500" />
            <span className="truncate">{source.repo}</span>
            <ExternalLink aria-hidden="true" className="size-3 shrink-0 opacity-70" />
          </a>
        ) : (
          <span className="flex items-center gap-1.5 font-sans">
            <Code2 aria-hidden="true" className="size-3 text-amber-500" /> Built-in snippet
          </span>
        )}

        <div className="flex shrink-0 items-center gap-3">
          {showGhost && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-purple-400 font-medium text-[10px]">
              👻 Ghost PB {ghostWpm ? `(${ghostWpm.toFixed(0)} WPM)` : ""}
            </span>
          )}
          {focusMode && <span className="hidden sm:inline font-sans text-xs">Esc to exit focus</span>}
          <span>Ln {currentLineIndex + 1}, Col {cursorCol}</span>
          <span className="h-3 w-px bg-border" />
          <span className="hidden sm:inline text-muted-foreground/80">UTF-8</span>
          <span className="h-3 w-px bg-border hidden sm:inline" />
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled={fontIndex <= 0}
              onClick={() => setPreference("fontSize", fontSizes[fontIndex - 1])}
              className="grid size-5 place-items-center rounded hover:bg-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
              aria-label="Decrease editor font size"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-8 text-center font-bold text-foreground">{preferences.fontSize}px</span>
            <button
              type="button"
              disabled={fontIndex >= fontSizes.length - 1}
              onClick={() => setPreference("fontSize", fontSizes[fontIndex + 1])}
              className="grid size-5 place-items-center rounded hover:bg-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
              aria-label="Increase editor font size"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
