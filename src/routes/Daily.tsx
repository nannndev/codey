import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, Flame, Play, RotateCcw, Target } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { RankMark } from "@/components/RankMark";
import { Podium3D } from "@/components/leaderboard/Podium3D";
import { PodiumCard, YourRankBar } from "@/components/leaderboard/BoardParts";
import { formatDailyDate, useCountdown, useDailyBoard } from "@/components/daily/DailyWidgets";
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM } from "@/utils/ranking";
import type { CloudProfile } from "@/lib/cloud";
import type { DailyRun } from "@/lib/daily";

function nameOf(run: DailyRun, profiles: Map<string, CloudProfile>) {
  const profile = profiles.get(run.userId);
  return profile?.displayName || profile?.githubUsername || `Typist ${run.userId.slice(0, 5)}`;
}

export default function Daily() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { board, error } = useDailyBoard(user?.$id);
  const countdown = useCountdown(board?.nextResetAt);
  const play = () => navigate("/?daily=1");

  const myIndex = board && user ? board.runs.findIndex((run) => run.userId === user.$id) : -1;
  const mine = myIndex >= 0 && board ? board.runs[myIndex] : null;
  const podium = board?.runs.slice(0, 3) ?? [];
  const rest = board?.runs.slice(3) ?? [];
  const preview = board?.challenge.code.split("\n").slice(0, 9).join("\n") ?? "";

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to typing
        </Link>

        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarDays className="size-3.5 text-amber-500" /> {board ? formatDailyDate(board.date) : "Today"} · UTC
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Daily Challenge</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One snippet from a real GitHub repo, the same for everyone, new every day.
            </p>
          </div>
          {board && (
            <div className="flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5 text-amber-500" /> Next challenge in <b className="font-mono text-foreground">{countdown}</b>
            </div>
          )}
        </header>

        {error ? (
          <div className="grid h-72 place-items-center rounded-2xl border bg-card/70 px-5 text-center text-sm text-muted-foreground">{error}</div>
        ) : !board ? (
          <div className="leaderboard-shimmer h-72 overflow-hidden rounded-2xl border bg-card/60" role="status" aria-label="Loading daily challenge" />
        ) : (
          <main className="animate-fade-in-up space-y-6">
            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-2xl border bg-card/80">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
                  <a href={board.challenge.sourceUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-xs text-muted-foreground hover:text-foreground">
                    {board.challenge.sourceRepo}/<b className="text-foreground">{board.challenge.filename}</b>
                  </a>
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-500">
                    {board.challenge.language}
                  </span>
                </div>
                <div className="relative">
                  <pre className="max-h-56 overflow-hidden px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">{preview}</pre>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/30 bg-card/80 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-background/40 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Flame className="size-3 text-orange-500" /> Streak</p>
                    <p className="mt-1 font-mono text-2xl font-black tabular-nums">{board.streak?.current ?? 0}<span className="ml-1 text-xs text-muted-foreground">days</span></p>
                    <p className="text-[10px] text-muted-foreground">Best {board.streak?.best ?? 0}</p>
                  </div>
                  <div className="rounded-xl border bg-background/40 p-3">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Target className="size-3 text-amber-500" /> Your best</p>
                    <p className="mt-1 font-mono text-2xl font-black tabular-nums">{mine ? mine.wpm.toFixed(1) : "–"}<span className="ml-1 text-xs text-muted-foreground">wpm</span></p>
                    <p className="text-[10px] text-muted-foreground">{mine ? `#${myIndex + 1} · ${mine.attempts} ${mine.attempts === 1 ? "attempt" : "attempts"}` : "Not played yet"}</p>
                  </div>
                </div>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  <li>· Unlimited attempts; your best run of the day counts.</li>
                  <li>· {MIN_RANKED_ACCURACY}% accuracy and {MIN_RANKED_WPM} WPM minimum, server-verified.</li>
                  <li>· Play on consecutive days to grow your streak.</li>
                </ul>
                <Button type="button" onClick={play} className="h-11 rounded-xl bg-amber-500 font-black text-zinc-950 hover:bg-amber-400">
                  {mine ? <><RotateCcw className="mr-1.5 size-4" /> Beat your best</> : <><Play className="mr-1.5 size-4" /> Play today's challenge</>}
                </Button>
                {!user && <p className="-mt-2 text-center text-[11px] text-muted-foreground">Sign in with GitHub to post a score.</p>}
              </div>
            </section>

            {board.runs.length === 0 ? (
              <div className="grid h-48 place-items-center rounded-2xl border border-dashed bg-card/60 px-5 text-center text-sm text-muted-foreground">
                Nobody has played today's challenge yet. Take the first spot.
              </div>
            ) : (
              <>
                <Podium3D
                  entries={[
                    ...podium.map((run, index) => {
                      const rank = (index + 1) as 1 | 2 | 3;
                      return {
                        rank,
                        onSelect: () => navigate(`/profile/${run.userId}`),
                        card: <PodiumCard run={run} rank={rank} profile={board.profiles.get(run.userId)} name={nameOf(run, board.profiles)} isMe={user?.$id === run.userId} />,
                      };
                    }),
                    ...([1, 2, 3] as const).filter((rank) => rank > podium.length).map((rank) => ({
                      rank,
                      empty: true,
                      onSelect: play,
                      card: (
                        <button type="button" onClick={play} className="flex w-full flex-col items-center rounded-xl border border-dashed bg-card/60 px-2 py-5 text-center text-muted-foreground transition-colors hover:text-foreground">
                          <span className="text-lg font-black">#{rank}</span>
                          <span className="text-[11px] font-semibold">Open spot</span>
                        </button>
                      ),
                    })),
                  ]}
                  fallback={null}
                />

                {rest.length > 0 && (
                  <section className="overflow-hidden rounded-2xl border bg-card/80">
                    <div className="grid grid-cols-[40px_1fr_70px_70px] gap-3 border-b bg-muted/45 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:grid-cols-[48px_1fr_90px_90px_70px]">
                      <span>#</span><span>Typist</span><span className="text-right">WPM</span><span className="text-right">Accuracy</span><span className="hidden text-right sm:block">Tries</span>
                    </div>
                    {rest.map((run, index) => {
                      const rank = index + 4;
                      const isMe = user?.$id === run.userId;
                      return (
                        <div
                          key={run.$id}
                          id={`leaderboard-rank-${rank}`}
                          className={`grid scroll-mt-24 grid-cols-[40px_1fr_70px_70px] items-center gap-3 border-b px-4 py-2.5 last:border-0 sm:grid-cols-[48px_1fr_90px_90px_70px] ${isMe ? "leaderboard-row-me" : ""}`}
                        >
                          <RankMark rank={rank} size="sm" />
                          <Link to={`/profile/${run.userId}`} className="truncate text-sm font-medium hover:text-muted-foreground">
                            {nameOf(run, board.profiles)}
                            {isMe && <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-500">You</span>}
                          </Link>
                          <span className="text-right font-mono text-base font-bold tabular-nums">{run.wpm.toFixed(1)}</span>
                          <span className="text-right text-sm tabular-nums">{run.accuracy.toFixed(1)}%</span>
                          <span className="hidden text-right text-xs text-muted-foreground sm:block">{run.attempts}</span>
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            )}

            <YourRankBar runs={board.runs} userId={user?.$id} ctaLabel="Play today's" ctaTo="/?daily=1" />
          </main>
        )}
      </div>
      <Footer />
    </div>
  );
}
