import { useState } from "react";
import { Swords, Trophy, X } from "lucide-react";
import { judgeChallenge, type Challenge } from "@/lib/challenges";
import type { RunResult } from "@/types";
import { cn } from "@/lib/utils";

function Avatar({ challenge, className }: { challenge: Challenge; className?: string }) {
  const [failed, setFailed] = useState(false);
  return challenge.username && !failed ? (
    <img src={`https://avatars.githubusercontent.com/${encodeURIComponent(challenge.username)}?s=80`} alt="" onError={() => setFailed(true)} className={cn("rounded-full object-cover", className)} />
  ) : (
    <span className={cn("grid place-items-center rounded-full bg-amber-500 font-black text-zinc-950", className)}>{challenge.name.slice(0, 1).toUpperCase()}</span>
  );
}

/** Above the editor while you race someone's challenge. */
export function ChallengeModeBanner({ challenge, onExit }: { challenge: Challenge; onExit: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent p-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar challenge={challenge} className="size-10 shrink-0 text-base ring-2 ring-amber-500/40" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"><Swords className="size-3.5" /> Challenge</p>
            <p className="truncate text-sm font-bold">
              Beat {challenge.name}&apos;s <span className="font-mono text-amber-600 dark:text-amber-400">{challenge.wpm.toFixed(1)} WPM</span>
              <span className="font-normal text-muted-foreground"> · {challenge.accuracy.toFixed(1)}% accuracy{challenge.language !== "All" ? ` · ${challenge.language}` : ""}</span>
            </p>
            <p className="text-xs text-muted-foreground">Same snippet, same rules. Start typing when you are ready.</p>
          </div>
        </div>
        <button type="button" onClick={onExit} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-3.5" /> Leave challenge
        </button>
      </div>
    </div>
  );
}

/** On the results screen: who won, and by how much. */
export function ChallengeResultBanner({ challenge, result }: { challenge: Challenge; result: RunResult }) {
  const outcome = judgeChallenge(challenge, result);
  const title = outcome.tie ? "Dead heat!" : outcome.won ? `You beat ${challenge.name}!` : `${challenge.name} wins this one`;
  const detail = outcome.margin === 0
    ? outcome.tie ? "Same speed, same accuracy." : `Same speed; ${outcome.won ? "your" : "their"} accuracy was higher.`
    : `${Math.abs(outcome.margin).toFixed(1)} WPM ${outcome.won ? "faster" : "slower"} (${result.wpm.toFixed(1)} vs ${challenge.wpm.toFixed(1)}).`;
  return (
    <div className={cn("mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 animate-fade-in-up", outcome.won ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card/70")}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 place-items-center rounded-xl", outcome.won ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
          {outcome.won ? <Trophy className="size-5" /> : <Swords className="size-5" />}
        </span>
        <div>
          <p className="text-sm font-black tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{detail} {outcome.won ? "Send it back as your own challenge." : "Try again, or challenge them back."}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1"><Avatar challenge={challenge} className="size-5 text-[10px]" /> {challenge.wpm.toFixed(1)}</span>
        <span className="text-muted-foreground">vs</span>
        <span className={cn("rounded-lg px-2 py-1 font-bold", outcome.won ? "bg-emerald-500 text-white" : "bg-foreground text-background")}>You {result.wpm.toFixed(1)}</span>
      </div>
    </div>
  );
}
