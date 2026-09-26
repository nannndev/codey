import { useEffect, useMemo, useState } from "react";
import { SYNC_EVENT } from "@/lib/account-sync";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock3, Flame, Gauge, Keyboard, Share2, Target, Trophy } from "lucide-react";
import { getHistory, getStreak, getPersonalBests } from "@/utils/storage";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { RunResult, TestMode } from "@/types";
import { useAuth, githubUsernameFromUser } from "@/components/AuthProvider";
import type { ShareCardOptions } from "@/lib/share-result";
import { SharePreviewDialog } from "@/components/SharePreviewDialog";
import { DailyGoals } from "@/components/DailyGoals";
import { ACCURACY_COLOR, DailyBars, LanguageBars, SPEED_COLOR, StatTile, TrendChart, TrendLegend } from "@/components/stats/Charts";
import { average, dailyBuckets, formatMinutes, formatRelative, languageSummary, recentDelta } from "@/lib/run-stats";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "all";
const RANGES: { value: Range; label: string; days: number | null }[] = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];
const MODES: (TestMode | "all")[] = ["all", "snippet", "timed", "zen"];

const chip = (active: boolean) =>
  cn(
    "h-8 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer",
    active ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

function Card({ title, sub, action, children, className }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card/80 p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const modeLabel = (run: Pick<RunResult, "mode" | "duration" | "snippetLength">) =>
  run.mode === "timed" ? `${Math.round(run.duration / 1000)}s timed` : run.mode === "snippet" ? `${run.snippetLength ?? ""} snippet`.trim() : "zen";

export default function History() {
  const { user } = useAuth();
  const [shareOptions, setShareOptions] = useState<ShareCardOptions | null>(null);
  const [range, setRange] = useState<Range>("30d");
  const [mode, setMode] = useState<TestMode | "all">("all");
  const [language, setLanguage] = useState("All");
  const [showAll, setShowAll] = useState(false);

  const [historyVersion, setHistoryVersion] = useState(0);
  useEffect(() => {
    const onSync = (event: Event) => {
      if ((event as CustomEvent<string[]>).detail?.includes("history")) setHistoryVersion((value) => value + 1);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);
  const allHistory = useMemo(() => (historyVersion >= 0 ? [...getHistory()].sort((a, b) => a.timestamp - b.timestamp) : []), [historyVersion]);
  const languages = useMemo(() => ["All", ...Array.from(new Set(allHistory.map((run) => run.language))).sort()], [allHistory]);
  // Re-read when another device's runs arrive (historyVersion changes).
  const streak = useMemo(getStreak, [historyVersion]);

  const days = RANGES.find((item) => item.value === range)?.days ?? null;
  const filtered = useMemo(() => {
    const cutoff = days ? Date.now() - days * 86_400_000 : 0;
    return allHistory.filter((run) => run.timestamp >= cutoff && (mode === "all" || run.mode === mode) && (language === "All" || run.language === language));
  }, [allHistory, days, mode, language]);

  const wpms = filtered.map((run) => run.wpm);
  const accs = filtered.map((run) => run.accuracy);
  const best = filtered.reduce<RunResult | null>((top, run) => (!top || run.wpm > top.wpm ? run : top), null);
  const minutes = filtered.reduce((sum, run) => sum + run.duration / 60_000, 0);
  const deltaSize = Math.min(10, Math.floor(filtered.length / 2));
  const chartDays = days && days <= 30 ? days : 30;
  const buckets = useMemo(() => dailyBuckets(filtered, chartDays), [filtered, chartDays]);
  const byLanguage = useMemo(() => languageSummary(filtered), [filtered]);
  const trend = filtered.slice(-60).map((run) => ({ t: run.timestamp, value: run.wpm, detail: `${run.language} · ${modeLabel(run)}` }));
  const accTrend = filtered.slice(-60).map((run) => ({ t: run.timestamp, value: run.accuracy, detail: run.language }));
  const accFloor = Math.max(0, Math.floor((Math.min(100, ...accs) - 2) / 5) * 5);

  const personalBests = useMemo(
    () =>
      getPersonalBests()
        .filter((pb) => (mode === "all" || pb.mode === mode) && (language === "All" || pb.language === language))
        .sort((a, b) => b.bestWpm - a.bestWpm),
    [mode, language, historyVersion]
  );
  const recent = [...filtered].reverse().slice(0, showAll ? 50 : 8);
  const shareName = user ? githubUsernameFromUser(user) : undefined;

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to typing
        </Link>

        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
              <BarChart3 className="size-3.5" /> Your progress
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Stats</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every run on this device, charted. Signed in? Your cloud history lives on your profile.</p>
          </div>
          <Link to="/analytics/keyboard" className="inline-flex h-9 items-center gap-1.5 self-start rounded-xl border bg-card/70 px-3.5 text-xs font-semibold transition-colors hover:bg-muted sm:self-auto">
            <Keyboard className="size-3.5 text-amber-500" /> Keyboard analytics
          </Link>
        </header>

        {/* One filter row; everything below follows it. */}
        <div className="sticky top-24 z-20 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/90 p-1.5 backdrop-blur-md">
          <div className="flex rounded-xl bg-muted/50 p-0.5" role="group" aria-label="Date range">
            {RANGES.map((item) => (
              <button key={item.value} type="button" onClick={() => setRange(item.value)} className={chip(range === item.value)}>{item.label}</button>
            ))}
          </div>
          <div className="flex rounded-xl bg-muted/50 p-0.5" role="group" aria-label="Mode">
            {MODES.map((item) => (
              <button key={item} type="button" onClick={() => setMode(item)} className={cn(chip(mode === item), "capitalize")}>{item === "all" ? "All modes" : item}</button>
            ))}
          </div>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Language"
            className="h-9 rounded-xl border bg-background/70 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {languages.map((item) => <option key={item} value={item}>{item === "All" ? "All languages" : item}</option>)}
          </select>
          <span className="ml-auto pr-2 text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "run" : "runs"}</span>
        </div>

        <main className="space-y-4 animate-fade-in-up">
          <DailyGoals />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<Gauge className="size-3.5" />}
              label="Average speed"
              value={average(wpms).toFixed(1)}
              unit="wpm"
              delta={deltaSize >= 3 ? recentDelta(wpms, deltaSize) : null}
              sub={deltaSize >= 3 ? `last ${deltaSize} vs the ${deltaSize} before` : "run more to see a trend"}
            />
            <StatTile icon={<Trophy className="size-3.5" />} label="Best run" value={best ? best.wpm.toFixed(1) : "–"} unit="wpm" sub={best ? `${best.language} · ${formatRelative(best.timestamp)}` : undefined} />
            <StatTile
              icon={<Target className="size-3.5" />}
              label="Accuracy"
              value={filtered.length ? average(accs).toFixed(1) : "–"}
              unit="%"
              delta={deltaSize >= 3 ? recentDelta(accs, deltaSize) : null}
              deltaUnit="pt"
            />
            <StatTile
              icon={<Clock3 className="size-3.5" />}
              label="Practice time"
              value={formatMinutes(minutes)}
              sub={<span className="inline-flex items-center gap-1"><Flame className="size-3 text-orange-500" /> {streak.current}-day streak · best {streak.best}</span>}
            />
          </div>

          <Card title="Speed" sub={`WPM for your last ${trend.length} runs`} action={<TrendLegend color={SPEED_COLOR} />}>
            <TrendChart points={trend} color={SPEED_COLOR} unit="wpm" label="Speed" />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Accuracy" sub="Percent of keystrokes correct" action={<TrendLegend color={ACCURACY_COLOR} />}>
              <TrendChart points={accTrend} color={ACCURACY_COLOR} unit="%" label="Accuracy" domain={[accFloor, 100]} height={180} />
            </Card>
            <Card title="Activity" sub={`Runs per day, last ${chartDays} days`}>
              <DailyBars days={buckets} height={180} />
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <Card title="Languages" sub="Average speed, most practiced first">
              <LanguageBars languages={byLanguage} />
            </Card>
            <Card title="Personal bests" sub="Best speed per language and format, all time">
              {personalBests.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="pb-2 text-left font-semibold">Language</th><th className="pb-2 text-left font-semibold">Format</th><th className="pb-2 text-right font-semibold">WPM</th><th className="pb-2 text-right font-semibold">Acc</th><th className="pb-2 text-right font-semibold">Runs</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {personalBests.map((pb) => (
                        <tr key={`${pb.language}-${pb.mode}-${pb.duration}-${pb.snippetLength}`}>
                          <td className="py-2 font-semibold">{pb.language}</td>
                          <td className="py-2 capitalize text-muted-foreground">{pb.mode === "timed" ? `${Math.round((pb.duration ?? 0) / 1000)}s timed` : pb.mode === "snippet" ? `${pb.snippetLength ?? ""} snippet` : "zen"}</td>
                          <td className="py-2 text-right font-mono font-bold tabular-nums">{pb.bestWpm.toFixed(1)}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{pb.bestAccuracy.toFixed(1)}%</td>
                          <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{pb.totalRuns}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Recent runs" sub="Newest first">
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No runs match these filters.</p>
            ) : (
              <>
                <div className="-mx-4 overflow-x-auto sm:-mx-5">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-4 pb-2 text-left font-semibold sm:px-5">Run</th>
                        <th className="pb-2 text-left font-semibold">When</th>
                        <th className="pb-2 text-right font-semibold">WPM</th>
                        <th className="pb-2 text-right font-semibold">Acc</th>
                        <th className="pb-2 text-right font-semibold">Time</th>
                        <th className="px-4 pb-2 sm:px-5"><span className="sr-only">Share</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {recent.map((run) => (
                        <tr key={run.id ?? run.timestamp} className="transition-colors hover:bg-muted/30">
                          <td className="max-w-56 px-4 py-2.5 sm:px-5">
                            <p className="truncate font-semibold">{run.filename ?? run.language}</p>
                            <p className="text-[11px] text-muted-foreground">{run.language} · {modeLabel(run)}</p>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{formatRelative(run.timestamp)}</td>
                          <td className={cn("py-2.5 text-right font-mono text-sm font-bold tabular-nums", best && run.wpm === best.wpm && "text-amber-600 dark:text-amber-400")}>{run.wpm.toFixed(1)}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{run.accuracy.toFixed(1)}%</td>
                          <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">{formatMinutes(run.duration / 60_000)}</td>
                          <td className="px-4 py-2.5 text-right sm:px-5">
                            <button
                              type="button"
                              onClick={() => setShareOptions({ result: run, username: shareName, heading: "History highlight" })}
                              className="grid size-7 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                              aria-label={`Share the ${run.wpm.toFixed(0)} WPM run`}
                            >
                              <Share2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 8 && (
                  <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 w-full rounded-xl border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
                    {showAll ? "Show fewer" : `Show more (${Math.min(50, filtered.length)} of ${filtered.length})`}
                  </button>
                )}
              </>
            )}
          </Card>
        </main>
      </div>
      <Footer />
      <SharePreviewDialog options={shareOptions} onClose={() => setShareOptions(null)} />
    </div>
  );
}
