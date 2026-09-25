import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ExternalLink, Flame, GitBranch, LoaderCircle, Play, ShieldCheck, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDailyBoard, type DailyBoard, type DailyChallenge, type DailySubmitResult } from "@/lib/daily";
import type { DailyStatus } from "@/hooks/useDailyGame";
import { cn } from "@/lib/utils";

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDailyDate(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Minute-resolution countdown to the next UTC reset. */
export function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return target ? formatCountdown(new Date(target).getTime() - now) : "";
}

export function useDailyBoard(userId: string | null | undefined, refreshKey = 0) {
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    getDailyBoard(userId ?? null)
      .then((next) => { if (!cancelled) setBoard(next); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Daily challenge unavailable."); });
    return () => { cancelled = true; };
  }, [userId, refreshKey]);
  return { board, error };
}

function SourceLine({ challenge, className }: { challenge: DailyChallenge; className?: string }) {
  return (
    <a
      href={challenge.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground", className)}
    >
      <GitBranch className="size-3.5 shrink-0 text-amber-500" />
      <span className="truncate font-mono">{challenge.sourceRepo}/{challenge.filename}</span>
      <ExternalLink className="size-3 shrink-0 opacity-60" />
    </a>
  );
}

/** Home-screen card for today's challenge. */
export function DailyChallengeCard({ userId, onPlay, disabled }: { userId?: string | null; onPlay: () => void; disabled?: boolean }) {
  const { board, error } = useDailyBoard(userId);
  const countdown = useCountdown(board?.nextResetAt);

  if (error) {
    return (
      <div className="daily-card flex items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-4 py-3 text-xs text-muted-foreground">
        <CalendarDays className="size-4 text-amber-500" /> {error}
      </div>
    );
  }
  if (!board) {
    return (
      <div className="daily-card flex items-center gap-3 rounded-2xl border bg-card/60 px-4 py-4 text-xs text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Picking today's snippet from GitHub…
      </div>
    );
  }

  const top = board.runs[0];
  const topName = top ? (board.profiles.get(top.userId)?.displayName || board.profiles.get(top.userId)?.githubUsername || "Typist") : null;
  const myIndex = userId ? board.runs.findIndex((run) => run.userId === userId) : -1;
  const mine = myIndex >= 0 ? board.runs[myIndex] : null;

  return (
    <section className="daily-card relative overflow-hidden rounded-2xl border border-amber-500/30 bg-card/70 p-4 backdrop-blur-md" aria-label="Today's daily challenge">
      <div className="daily-card__glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
            <CalendarDays className="size-3.5" /> Daily challenge · {formatDailyDate(board.date)}
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 tracking-wider">{board.challenge.language}</span>
          </p>
          <SourceLine challenge={board.challenge} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
            <span>{board.runs.length} {board.runs.length === 1 ? "player" : "players"}</span>
            {top && <span className="inline-flex items-center gap-1"><Trophy className="size-3 text-amber-500" /> {topName} · <b className="font-mono text-foreground">{top.wpm.toFixed(1)}</b> WPM</span>}
            {mine && <span>Your best <b className="font-mono text-foreground">{mine.wpm.toFixed(1)}</b> · #{myIndex + 1}</span>}
            {board.streak && board.streak.current > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-orange-500"><Flame className="size-3.5" /> {board.streak.current}-day streak</span>
            )}
            <span>New one in {countdown}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold">
            <Link to="/daily">Board</Link>
          </Button>
          <Button type="button" size="sm" onClick={onPlay} disabled={disabled} className="h-9 rounded-xl bg-amber-500 text-xs font-black text-zinc-950 hover:bg-amber-400">
            <Play className="mr-1 size-3.5" /> {mine ? "Beat your best" : "Play today's"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Banner above the editor while a daily attempt is active. */
export function DailyModeBanner({ challenge, status, error, onExit }: {
  challenge: DailyChallenge | null;
  status: DailyStatus;
  error: string | null;
  onExit: () => void;
}) {
  return (
    <div className="daily-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 animate-fade-in-up">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-500">
          <CalendarDays className="size-4" /> Daily challenge{challenge ? ` · ${formatDailyDate(challenge.date)}` : ""}
        </p>
        {challenge && <SourceLine challenge={challenge} />}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold",
          status === "rejected" ? "border-red-500/40 text-red-500" : status === "practice" ? "text-muted-foreground" : "border-amber-500/40 text-amber-500",
        )}>
          {status === "loading" && <><LoaderCircle className="size-3 animate-spin" /> Loading</>}
          {(status === "ready" || status === "submitting" || status === "verified") && <><ShieldCheck className="size-3" /> Verified attempt</>}
          {status === "practice" && "Practice only · sign in to post"}
          {status === "rejected" && (error ?? "Attempt unavailable")}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onExit} className="h-8 text-xs" aria-label="Leave daily challenge">
          <X className="mr-1 size-3.5" /> Leave
        </Button>
      </div>
    </div>
  );
}

/** Daily outcome shown above the results screen. */
export function DailyResultBanner({ status, outcome, error }: { status: DailyStatus; outcome: DailySubmitResult | null; error: string | null }) {
  if (status === "submitting") {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-500">
        <LoaderCircle className="size-3.5 animate-spin" /> Verifying your daily run…
      </div>
    );
  }
  if (status === "practice") {
    return (
      <div className="mt-8 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-center text-xs text-muted-foreground">
        Practice run on today's challenge. Sign in with GitHub to post daily scores and keep a streak.
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs font-semibold text-red-500">
        Daily run not posted: {error}
      </div>
    );
  }
  if (status !== "verified" || !outcome) return null;
  return (
    <div className="daily-result mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-amber-500 font-mono text-base font-black text-zinc-950">#{outcome.rank}</span>
        <div>
          <p className="text-sm font-black">
            {outcome.improved ? "New daily best!" : "Daily run posted"}
            <span className="ml-2 font-mono text-amber-500">{outcome.best.wpm.toFixed(1)} WPM</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            This run {outcome.wpm.toFixed(1)} WPM · {outcome.accuracy.toFixed(1)}% · attempt {outcome.best.attempts}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {outcome.streak.current > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-black text-orange-500">
            <Flame className="size-4" /> {outcome.streak.current}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">day streak</span>
          </span>
        )}
        <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold">
          <Link to="/daily">See board</Link>
        </Button>
      </div>
    </div>
  );
}
