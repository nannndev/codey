import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Cloud,
  CloudOff,
  ExternalLink,
  Flame,
  Gauge,
  GitBranch,
  Keyboard,
  LoaderCircle,
  Share2,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { githubUsernameFromUser, useAuth } from "@/components/AuthProvider";
import { cloudRunAsResult, getProfile, listUserRuns, type CloudProfile, type CloudRun } from "@/lib/cloud";
import { getStreak } from "@/utils/storage";
import type { ShareCardOptions } from "@/lib/share-result";
import { SharePreviewDialog } from "@/components/SharePreviewDialog";
import { computeKeyStatsFromCloudRuns, getPendingKeyboardStats, getStoredKeyStats, getVisibleKeyStats, mergeStatsMaps, type KeyboardStatsMap } from "@/utils/keyboard-analytics";
import { getCloudKeyboardStats } from "@/lib/keyboard-stats-cloud";
import { DivisionBadge } from "@/components/DivisionBadge";
import { ActivityCalendar, LanguageBars, SPEED_COLOR, StatTile, TrendChart, TrendLegend } from "@/components/stats/Charts";
import { average, dailyBuckets, formatMinutes, formatRelative, languageSummary, recentDelta, streakFromRuns, type RunLike } from "@/lib/run-stats";
import { drillCharFor, rankKeys } from "@/lib/key-metrics";
import { keyLabel } from "@/lib/keyboard-layout";
import { cn } from "@/lib/utils";
import { AchievementBadge } from "@/components/achievements/Badge";
import { TIER_NAMES } from "@/lib/achievements";
import { useAchievements } from "@/hooks/useAchievements";

const asRunLike = (run: CloudRun): RunLike & { source: CloudRun } => ({
  timestamp: new Date(run.$createdAt).getTime(),
  wpm: run.wpm,
  accuracy: run.accuracy,
  language: run.language,
  mode: run.mode,
  duration: run.mode === "timed" && run.durationSeconds ? run.durationSeconds * 1000 : run.durationMs,
  source: run,
});

const formatLabel = (run: CloudRun) =>
  run.mode === "timed" ? `${run.durationSeconds ?? Math.round(run.durationMs / 1000)}s timed` : run.mode === "snippet" ? `${run.snippetLength ?? ""} snippet`.trim() : "zen";

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

export default function Profile() {
  const { user, loading, configured, login, syncStatus, retrySync } = useAuth();
  const { userId } = useParams();
  const viewedUserId = userId || user?.$id;
  const isOwnProfile = Boolean(user && viewedUserId === user.$id);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [runs, setRuns] = useState<CloudRun[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [shareOptions, setShareOptions] = useState<ShareCardOptions | null>(null);
  const [cloudKeyStats, setCloudKeyStats] = useState<KeyboardStatsMap | null>(null);
  const localStreak = useMemo(() => getStreak(), []);

  useEffect(() => {
    if (!viewedUserId) {
      setProfile(null);
      setRuns([]);
      return;
    }
    setDataLoading(true);
    void Promise.all([getProfile(viewedUserId), listUserRuns(viewedUserId)])
      .then(([nextProfile, nextRuns]) => {
        setProfile(nextProfile);
        setRuns(nextRuns);
      })
      .catch((error) => console.error("Unable to load cloud profile", error))
      .finally(() => setDataLoading(false));
  }, [viewedUserId, syncStatus]);

  useEffect(() => {
    if (!isOwnProfile || !user?.$id) {
      setCloudKeyStats(null);
      return;
    }
    let cancelled = false;
    void getCloudKeyboardStats().then((stats) => {
      if (!cancelled) setCloudKeyStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user?.$id, syncStatus]);

  const githubUsername = profile?.githubUsername || (isOwnProfile && user ? githubUsernameFromUser(user) : undefined);
  const displayName = profile?.displayName || (isOwnProfile ? user?.name : undefined) || githubUsername || "Code typist";
  const avatarUrl = profile?.avatarUrl || (githubUsername ? `https://avatars.githubusercontent.com/${githubUsername}?s=160` : undefined);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Oldest first for charts; cloud returns newest first.
  const timeline = useMemo(() => runs.map(asRunLike).sort((a, b) => a.timestamp - b.timestamp), [runs]);
  const wpms = timeline.map((run) => run.wpm);
  const accs = timeline.map((run) => run.accuracy);
  const best = timeline.reduce<(typeof timeline)[number] | null>((top, run) => (!top || run.wpm > top.wpm ? run : top), null);
  const avgAccuracy = average(accs);
  const recentAvg = average(wpms.slice(-10));
  const deltaSize = Math.min(10, Math.floor(timeline.length / 2));
  const minutes = timeline.reduce((sum, run) => sum + run.duration / 60_000, 0);
  const cloudStreak = useMemo(() => streakFromRuns(timeline), [timeline]);
  const currentStreak = Math.max(profile?.currentStreak ?? 0, cloudStreak.current, isOwnProfile ? localStreak.current : 0);
  const bestStreak = Math.max(profile?.bestStreak ?? 0, cloudStreak.best, isOwnProfile ? localStreak.best : 0);
  const byLanguage = useMemo(() => languageSummary(timeline), [timeline]);
  const calendar = useMemo(() => dailyBuckets(timeline, 26 * 7), [timeline]);
  const trend = timeline.slice(-80).map((run) => ({ t: run.timestamp, value: run.wpm, detail: `${run.language} · ${formatLabel(run.source)}` }));
  const joined = profile?.$createdAt ? new Date(profile.$createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;

  // Best run per format, the numbers people compare.
  const records = useMemo(() => {
    const groups = new Map<string, (typeof timeline)[number]>();
    for (const run of timeline) {
      const key = formatLabel(run.source);
      const current = groups.get(key);
      if (!current || run.wpm > current.wpm) groups.set(key, run);
    }
    return [...groups.entries()].sort((a, b) => b[1].wpm - a[1].wpm).slice(0, 5);
  }, [timeline]);

  const userKeyStats = useMemo(() => {
    const localStats = isOwnProfile
      ? cloudKeyStats
        ? (() => {
            const pendingStats = getPendingKeyboardStats(viewedUserId)?.stats || {};
            return Object.keys(cloudKeyStats).length > 0 || Object.keys(pendingStats).length > 0
              ? mergeStatsMaps(cloudKeyStats, pendingStats)
              : getVisibleKeyStats(viewedUserId);
          })()
        : getVisibleKeyStats(viewedUserId)
      : getStoredKeyStats(viewedUserId);
    return computeKeyStatsFromCloudRuns(runs, localStats);
  }, [viewedUserId, runs, isOwnProfile, cloudKeyStats]);
  const weakKeys = useMemo(() => rankKeys(userKeyStats, "accuracy", 5), [userKeyStats]);

  // Own profile: device + account. Others: what their verified cloud data shows.
  const { evaluation: badgeEvaluation } = useAchievements({ userId: viewedUserId, own: isOwnProfile, runs: isOwnProfile ? undefined : runs });
  const badges = useMemo(() => {
    const tiers = badgeEvaluation.families
      .filter((item) => item.tier > 0)
      .sort((a, b) => b.tier - a.tier)
      .map((item) => ({ key: item.family.id, kind: item.family.id, tier: item.tier || undefined, name: `${item.family.name}`, sub: TIER_NAMES[item.tier as 1 | 2 | 3 | 4] }));
    const feats = badgeEvaluation.singles.filter((item) => item.unlocked).map((item) => ({ key: item.single.id, kind: item.single.id, tier: undefined, name: item.single.name, sub: "Feat" }));
    return { shown: [...tiers, ...feats], earned: badgeEvaluation.earned.size, total: badgeEvaluation.families.length * 4 + badgeEvaluation.singles.length };
  }, [badgeEvaluation]);

  const syncLabel = syncStatus === "syncing" ? "Syncing" : syncStatus === "error" ? "Sync failed · retry" : "Synced";
  const SyncIcon = syncStatus === "syncing" ? LoaderCircle : syncStatus === "error" ? CloudOff : Cloud;

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to typing
        </Link>

        {!viewedUserId ? (
          <main className="mx-auto grid max-w-lg place-items-center rounded-2xl border bg-card/80 p-10 text-center backdrop-blur-sm">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl border bg-muted/60"><UserRound className="size-7" /></div>
            <h1 className="text-2xl font-bold">Your Codey profile</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in with GitHub to sync this browser's history and enter the community leaderboard.</p>
            {configured && <Button className="mt-6" onClick={login} disabled={loading}><GitBranch data-icon="inline-start" /> Continue with GitHub</Button>}
          </main>
        ) : (
          <main className="animate-fade-in-up space-y-4">
            <section className="profile-hero overflow-hidden rounded-2xl border bg-card/80">
              <div className="profile-hero__banner h-24 sm:h-28" aria-hidden="true" />
              <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                <div className="-mt-10 flex min-w-0 items-end gap-4">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-amber-500 text-3xl font-black text-zinc-950 shadow-md sm:size-24">
                    {avatarUrl && !avatarFailed ? (
                      <img src={avatarUrl} alt="" className="size-full object-cover" onError={() => setAvatarFailed(true)} />
                    ) : (
                      displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{displayName}</h1>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {githubUsername && (
                        <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-foreground hover:underline">
                          <GitBranch className="size-3" /> @{githubUsername}
                        </a>
                      )}
                      {joined && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> Joined {joined}</span>}
                      {byLanguage[0] && <span>Mostly {byLanguage[0].language}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => void retrySync()}
                      title="Cloud history sync"
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors cursor-pointer",
                        syncStatus === "error" ? "border-rose-500/50 text-rose-500 hover:bg-rose-500/10" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <SyncIcon className={cn("size-3.5", syncStatus === "syncing" && "animate-spin")} /> {syncLabel}
                    </button>
                  )}
                  {best && (
                    <button
                      type="button"
                      onClick={() => setShareOptions({ result: cloudRunAsResult(best.source), username: githubUsername || profile?.displayName || undefined, heading: "Codey profile highlight" })}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      <Share2 className="size-3.5" /> Share
                    </button>
                  )}
                </div>
              </div>
            </section>

            <DivisionBadge bestWpm={best?.wpm ?? 0} avgAccuracy={avgAccuracy} size="lg" showProgress />

            {dataLoading && runs.length === 0 ? (
              <div className="grid h-48 place-items-center rounded-2xl border bg-card/60"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>
            ) : runs.length === 0 ? (
              <div className="grid h-48 place-items-center rounded-2xl border border-dashed bg-card/60 px-6 text-center text-sm text-muted-foreground">
                {isOwnProfile ? "No cloud runs yet. Finish a run and it syncs here." : "This typist has no public runs yet."}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile icon={<Trophy className="size-3.5" />} label="Best run" value={best ? best.wpm.toFixed(1) : "–"} unit="wpm" sub={best ? `${best.language} · ${formatRelative(best.timestamp)}` : undefined} />
                  <StatTile
                    icon={<Gauge className="size-3.5" />}
                    label="Recent speed"
                    value={recentAvg.toFixed(1)}
                    unit="wpm"
                    delta={deltaSize >= 3 ? recentDelta(wpms, deltaSize) : null}
                    sub={`avg of last ${Math.min(10, timeline.length)}`}
                  />
                  <StatTile icon={<Target className="size-3.5" />} label="Accuracy" value={avgAccuracy.toFixed(1)} unit="%" delta={deltaSize >= 3 ? recentDelta(accs, deltaSize) : null} deltaUnit="pt" />
                  <StatTile icon={<Flame className="size-3.5" />} label="Streak" value={`${currentStreak}`} unit={currentStreak === 1 ? "day" : "days"} sub={`best ${bestStreak} · ${formatMinutes(minutes)} typed`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                  <Card title="Activity" sub="Runs per day, last 26 weeks">
                    <ActivityCalendar days={calendar} />
                  </Card>
                  <Card title="Records" sub="Best run in each format">
                    <ul className="divide-y divide-border/50">
                      {records.map(([format, run]) => (
                        <li key={format} className="flex items-center justify-between gap-3 py-2 text-xs">
                          <span className="min-w-0">
                            <span className="block font-semibold capitalize">{format}</span>
                            <span className="text-muted-foreground">{run.language} · {formatRelative(run.timestamp)}</span>
                          </span>
                          <span className="font-mono tabular-nums"><b className="text-sm">{run.wpm.toFixed(1)}</b> <span className="text-muted-foreground">wpm</span></span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                <Card
                  title="Achievements"
                  sub={`${badges.earned} of ${badges.total} earned${isOwnProfile ? "" : " · verified by the server"}`}
                  action={
                    isOwnProfile ? (
                      <Link to="/achievements" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        All badges <ArrowUpRight className="size-3.5" />
                      </Link>
                    ) : undefined
                  }
                >
                  {badges.shown.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No badges yet. Finish a few runs to earn the first ones.</p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-5 lg:grid-cols-8">
                      {badges.shown.slice(0, 16).map((badge) => (
                        <li key={badge.key} className="flex flex-col items-center text-center">
                          <AchievementBadge kind={badge.kind} tier={badge.tier} size={60} label={`${badge.name} ${badge.sub}`} />
                          <span className="mt-1 max-w-full truncate text-[11px] font-semibold">{badge.name}</span>
                          <span className="text-[10px] text-muted-foreground">{badge.sub}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title="Speed over time" sub={`WPM across the last ${trend.length} runs`} action={<TrendLegend color={SPEED_COLOR} />}>
                  <TrendChart points={trend} color={SPEED_COLOR} unit="wpm" label="Speed" averageWindow={8} />
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card title="Languages" sub={`${byLanguage.length} languages · average speed`}>
                    <LanguageBars languages={byLanguage} />
                  </Card>
                  {isOwnProfile ? (
                    <Card
                      title="Keys to practice"
                      sub="Lowest accuracy, 10+ presses"
                      action={
                        <Link to="/analytics/keyboard" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                          3D analytics <ArrowUpRight className="size-3.5" />
                        </Link>
                      }
                    >
                      {weakKeys.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Type a bit more to find your weak keys.</p>
                      ) : (
                        <ul className="space-y-2">
                          {weakKeys.map((stat) => {
                            const drill = drillCharFor(stat.key);
                            return (
                              <li key={stat.key} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 text-xs">
                                <kbd className="grid h-8 place-items-center rounded-lg border-b-2 bg-muted font-mono text-sm font-bold">{keyLabel(stat.key) || stat.key}</kbd>
                                <span>
                                  <span className="flex justify-between"><b>{stat.accuracy.toFixed(1)}%</b><span className="text-muted-foreground">{stat.avgDelayMs.toFixed(0)} ms</span></span>
                                  <span className="mt-1 block h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-rose-500" style={{ width: `${Math.max(4, 100 - stat.accuracy) * 4}%`, maxWidth: "100%" }} /></span>
                                </span>
                                {drill ? (
                                  <Link to={`/?drill=${encodeURIComponent(drill)}`} className="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold hover:bg-muted">
                                    <Keyboard className="size-3" /> Drill
                                  </Link>
                                ) : <span />}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Card>
                  ) : (
                    <Card title="Totals" sub="Everything this typist has synced">
                      <dl className="grid grid-cols-2 gap-3 text-xs">
                        {[
                          ["Runs", `${runs.length}`],
                          ["Time typing", formatMinutes(minutes)],
                          ["Best streak", `${bestStreak} days`],
                          ["Languages", `${byLanguage.length}`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border bg-background/40 p-3">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  )}
                </div>

                <Card title="Recent runs" sub={`${runs.length} synced in total`}>
                  <ul className="-mx-4 divide-y divide-border/50 sm:-mx-5">
                    {runs.slice(0, 6).map((run) => (
                      <li key={run.$id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-xs sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{run.language}</span>
                          <span className="text-muted-foreground"><span className="capitalize">{formatLabel(run)}</span> · {formatRelative(new Date(run.$createdAt).getTime())}</span>
                        </span>
                        <span className="text-right font-mono tabular-nums"><b className="text-sm">{run.wpm.toFixed(1)}</b> <span className="text-muted-foreground">wpm</span></span>
                        <span className="w-14 text-right font-mono tabular-nums text-muted-foreground">{run.accuracy.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                  {isOwnProfile && (
                    <Link to="/history" className="mt-3 flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Clock3 className="size-3.5" /> All stats on this device
                    </Link>
                  )}
                </Card>
              </>
            )}

            {githubUsername && (
              <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <GitBranch className="size-3.5" /> View @{githubUsername} on GitHub <ExternalLink className="size-3" />
              </a>
            )}
          </main>
        )}
      </div>
      <Footer />
      <SharePreviewDialog options={shareOptions} onClose={() => setShareOptions(null)} />
    </div>
  );
}
