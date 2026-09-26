import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Code2, Flame, Keyboard, RotateCcw, Share2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KapMascot } from "@/components/streak/KapMascot";
import { FLAME_TIERS } from "@/lib/streak";
import type { TextLanguage } from "@/lib/text-practice";
import { cn } from "@/lib/utils";

/**
 * First visit: three quick steps (what to type, which language, how it works)
 * with Kap, then straight into the editor with those choices applied.
 */

export type OnboardingChoice =
  | { kind: "code"; language: string }
  | { kind: "words"; textLanguage: TextLanguage }
  | { kind: "passages" };

const STORAGE_KEY = "codey_onboarded_v1";
const FEATURED = ["All", "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C++", "PHP", "C#", "Ruby", "Kotlin"];

export function shouldOnboard(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    // Anyone with history has already found their way around.
    const history = JSON.parse(localStorage.getItem("codetype_history") ?? "[]") as unknown[];
    return history.length === 0;
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Shown again next time; harmless.
  }
}

interface OnboardingDialogProps {
  open: boolean;
  languages: string[];
  onComplete: (choice: OnboardingChoice | null) => void;
}

function OptionCard({ active, onClick, icon: Icon, title, body }: { active: boolean; onClick: () => void; icon: typeof Code2; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
        active ? "border-amber-500 bg-amber-500/10 shadow-sm" : "hover:border-foreground/25 hover:bg-muted/50",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-amber-500 text-zinc-950" : "bg-muted text-muted-foreground")}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

export function OnboardingDialog({ open, languages, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"code" | "text">("code");
  const [language, setLanguage] = useState("All");
  const [text, setText] = useState<"english" | "indonesian" | "passages">("english");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onComplete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onComplete]);

  if (!open) return null;
  const featured = FEATURED.filter((item) => languages.includes(item));
  const finish = () =>
    onComplete(kind === "code" ? { kind: "code", language } : text === "passages" ? { kind: "passages" } : { kind: "words", textLanguage: text });
  const bubble = [
    "Hi, I'm Kap! What would you like to practice?",
    kind === "code" ? "Nice. Pick a language, or mix them all." : "Great. Words for pure speed, passages for real sentences.",
    "That's it! Keep a streak going and my flame grows.",
  ][step];

  return (
    // Keys pressed here must not start a run in the editor behind.
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Welcome to Codey" onKeyDown={(event) => event.stopPropagation()}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl animate-scale-in">
        <button type="button" onClick={() => onComplete(null)} className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Skip introduction">
          <X className="size-4" />
        </button>

        <div className="flex items-end gap-3 bg-gradient-to-b from-amber-500/15 to-transparent px-5 pt-5">
          <KapMascot mood="lit" tier={FLAME_TIERS[step === 2 ? 2 : 1]} size={84} jump={step === 2} className="shrink-0" />
          <div className="relative mb-4 rounded-2xl rounded-bl-sm border bg-background px-3.5 py-2.5 text-sm font-medium shadow-sm" aria-live="polite">
            {bubble}
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          {step === 0 && (
            <div className="space-y-2">
              <OptionCard active={kind === "code"} onClick={() => setKind("code")} icon={Code2} title="Code" body="Real snippets from popular open-source repos on GitHub." />
              <OptionCard active={kind === "text"} onClick={() => setKind("text")} icon={Type} title="Text" body="Common words in English or Indonesian, or passages from classic novels." />
            </div>
          )}

          {step === 1 && kind === "code" && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {featured.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  aria-pressed={language === item}
                  className={cn("rounded-lg border px-2 py-2 text-xs font-semibold transition-colors", language === item ? "border-amber-500 bg-amber-500/10" : "hover:bg-muted/60")}
                >
                  {item === "All" ? "Mix of all" : item}
                </button>
              ))}
            </div>
          )}

          {step === 1 && kind === "text" && (
            <div className="space-y-2">
              <OptionCard active={text === "english"} onClick={() => setText("english")} icon={Type} title="English words" body="The 1,000 most common English words." />
              <OptionCard active={text === "indonesian"} onClick={() => setText("indonesian")} icon={Type} title="Kata bahasa Indonesia" body="1.000 kata bahasa Indonesia yang paling umum." />
              <OptionCard active={text === "passages"} onClick={() => setText("passages")} icon={BookOpen} title="Novel passages" body="Paragraphs from Sherlock Holmes, Alice, Dracula and more." />
            </div>
          )}

          {step === 2 && (
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-3"><Keyboard className="mt-0.5 size-4 shrink-0 text-amber-500" /><span><strong>Just start typing.</strong> The timer starts on your first key; mistakes show in red.</span></li>
              <li className="flex items-start gap-3"><RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-500" /><span><strong>Try again anytime.</strong> Press Enter on the results, or use the restart shortcut in Settings.</span></li>
              <li className="flex items-start gap-3"><Flame className="mt-0.5 size-4 shrink-0 text-amber-500" /><span><strong>One run a day keeps the streak.</strong> I sit in the top bar and remind you.</span></li>
              <li className="flex items-start gap-3"><Share2 className="mt-0.5 size-4 shrink-0 text-amber-500" /><span><strong>Share or challenge friends.</strong> Sign in with GitHub to sync, rank and send challenge links.</span></li>
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((index) => <span key={index} className={cn("h-1.5 rounded-full transition-all", index === step ? "w-5 bg-amber-500" : "w-1.5 bg-muted-foreground/30")} />)}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  <ArrowLeft data-icon="inline-start" /> Back
                </Button>
              )}
              {step < 2 ? (
                <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
                  Next <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={finish} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
                  Start typing <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
