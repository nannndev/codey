import { useEffect, useMemo, useRef } from "react";
import { Code2, ExternalLink, FileCode2, GitBranch, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePreferences } from "@/components/PreferencesProvider";
import type { CharState } from "@/types";
import { tokenizeCode, type SyntaxToken } from "@/utils/syntax";

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
}: CodeDisplayProps) {
  const { preferences, setPreference } = usePreferences();
  const cursorStyle = preferences.cursorStyle as CursorPref;
  const CursorComponent = CURSOR_COMPONENTS[cursorStyle];
  const fontSizes = ["12", "14", "16", "18", "20", "22", "24"] as const;
  const fontIndex = fontSizes.indexOf(preferences.fontSize);
  const syntaxTokens = useMemo(() => tokenizeCode(chars.map((char) => char.char).join("")), [chars]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

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
      className={cn(
        "code-window overflow-hidden rounded-2xl border border-border/80 shadow-2xl focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:ring-offset-2 focus-within:ring-offset-background transition-all duration-200",
        focusMode && "code-window-focus"
      )}
      onClick={onClick}
      tabIndex={0}
    >
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
            <FileCode2 aria-hidden="true" className="size-3.5 text-amber-500 shrink-0" />
            <span className="truncate font-semibold text-foreground/90">{filename}</span>
            <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 rounded-md shrink-0 bg-muted text-muted-foreground">
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
      <div ref={viewportRef} className="code-viewport min-w-0 overflow-auto py-5">
        <div className="min-w-max">
          {lines.map((line, li) => (
            <div key={li} className={cn("code-row", li === currentLineIndex && "is-current-line")}>
              <span className={cn("code-line-number", li === currentLineIndex && "is-current text-amber-500 font-bold")}>
                {li + 1}
              </span>
              <div className="whitespace-pre px-4">
                {line.map(({ state: c, syntax, globalIndex }, ci) => {
                  const isGhostHere = showGhost && globalIndex === effectiveGhostIndex;

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
                      key={`${li}-${ci}`}
                      className={cn(
                        "syntax-char transition-all duration-100 relative",
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
          ))}
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
