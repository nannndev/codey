import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowLeft, LoaderCircle, Share2, Timer, Trophy, Zap } from "lucide-react";
import { Podium3D } from "@/components/leaderboard/Podium3D";
import { Footer } from "@/components/Footer";
import { getLanguages } from "@/data";
import { type CloudProfile, type CloudRun } from "@/lib/cloud";
import { getLeaderboardView } from "@/lib/leaderboard-api";
import type { SnippetLength, RunResult } from "@/types";
import type { ShareCardOptions } from "@/lib/share-result";
import { SharePreviewDialog } from "@/components/SharePreviewDialog";
import { useAuth } from "@/components/AuthProvider";
import { RankMark } from "@/components/RankMark";
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM } from "@/utils/ranking";
import { DivisionBadge } from "@/components/DivisionBadge";

type Board = "snippet" | "timed";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`leaderboard-shimmer overflow-hidden rounded-md bg-foreground/[0.07] ${className}`} />;
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading leaderboard">
      <section className="overflow-hidden rounded-2xl border bg-card/65 p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <LoaderCircle className="size-3 animate-spin" /> Syncing ranked telemetry
        </div>
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
          {["h-44", "h-52", "h-40"].map((height, index) => (
            <div key={height} className={`flex ${height} flex-col items-center justify-end rounded-xl border bg-card/70 p-3 ${index === 1 ? "border-amber-500/20" : ""}`}>
              <SkeletonBlock className="mb-3 size-11 rounded-full" />
              <SkeletonBlock className="mb-2 h-3 w-3/5" />
              <SkeletonBlock className="mb-1 h-7 w-2/5" />
              <SkeletonBlock className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border bg-card/80">
        <div className="grid grid-cols-[40px_1fr_70px_70px] gap-3 border-b bg-muted/30 px-4 py-3 sm:grid-cols-[48px_1fr_90px_90px_90px]">
          {["w-5", "w-20", "hidden w-12 sm:block", "ml-auto w-12", "ml-auto w-14"].map((width) => <SkeletonBlock key={width} className={`h-2.5 ${width}`} />)}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid grid-cols-[40px_1fr_70px_70px] items-center gap-3 border-b px-4 py-3 last:border-0 sm:grid-cols-[48px_1fr_90px_90px_90px]" style={{ opacity: 1 - index * 0.1 }}>
            <SkeletonBlock className="size-7 rounded-lg" />
            <div className="flex items-center gap-2.5"><SkeletonBlock className="size-7 shrink-0 rounded-md" /><SkeletonBlock className="h-3 w-24 sm:w-36" /></div>
            <SkeletonBlock className="hidden h-3 w-14 sm:block" />
            <SkeletonBlock className="ml-auto h-4 w-11" />
            <SkeletonBlock className="ml-auto h-3 w-12" />
          </div>
        ))}
      </section>
    </div>
  );
}

function displayName(run: CloudRun, profiles: Map<string, CloudProfile>): string {
  const profile = profiles.get(run.userId);
  return profile?.displayName || profile?.githubUsername || `Typist ${run.userId.slice(0, 5)}`;
}

function cloudRunAsResult(run: CloudRun): RunResult {
  return {
    language: run.language,
    mode: run.mode,
    duration: run.mode === "timed" && run.durationSeconds ? run.durationSeconds * 1000 : run.durationMs,
    wpm: run.wpm,
    rawWpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    totalCorrect: run.correctChars,
    charsTyped: run.keystrokes,
    totalErrors: run.mistakes,
    snippetsCompleted: run.snippetsCompleted,
    timestamp: new Date(run.$createdAt).getTime(),
    perLineStats: [],
    errorPositions: [],
    sourceRepo: run.sourceRepo,
    snippetLength: run.snippetLength,
  };
}

// ──── DEMO MODE: set to false to use real data ────
const DEMO_MODE = false;

const DEMO_NAMES = ["TurboTyper", "CodeNinja42", "SyntaxQueen", "ByteMaster", "DevFlow", "PixelPioneer", "TypeRacer_Pro", "LoopLord", "AsyncAvenger", "HashHero", "VoidRunner", "StackSurfer", "NullPointer", "RegexWizard", "LambdaLion"];
const DEMO_LANGUAGES = ["TypeScript", "Python", "Rust", "Go", "JavaScript", "C++", "Java", "Swift", "Kotlin", "Ruby"];
const DEMO_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Milo",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Max",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Zara",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Leo",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Nori",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Kit",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Jade",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Rex",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Ivy",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Bear",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Sage",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Ace",
];

function generateDemoRuns(): { runs: CloudRun[]; profiles: Map<string, CloudProfile> } {
  const demoRuns: CloudRun[] = [];
  const demoProfiles = new Map<string, CloudProfile>();

  for (let i = 0; i < 15; i++) {
    const userId = `demo_user_${String(i).padStart(3, "0")}`;
    const wpm = Math.round((145 - i * 8 + Math.random() * 10) * 10) / 10;
    const accuracy = Math.round((99.2 - i * 0.5 + Math.random() * 0.8) * 10) / 10;
    const lang = DEMO_LANGUAGES[i % DEMO_LANGUAGES.length];

    demoRuns.push({
      $id: `demo_run_${i}`,
      $collectionId: "runs",
      $databaseId: "codey",
      $createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      $updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
      $permissions: [],
      $sequence: String(i + 1),
      userId,
      language: lang,
      mode: "snippet" as const,
      durationMs: 45000 + Math.random() * 30000,
      wpm,
      rawWpm: wpm + Math.random() * 8,
      accuracy,
      consistency: 85 + Math.random() * 12,
      correctChars: 200 + Math.floor(Math.random() * 100),
      keystrokes: 250 + Math.floor(Math.random() * 100),
      mistakes: Math.floor(Math.random() * 8),
      snippetsCompleted: 1,
      verified: true,
      snippetLength: "medium" as const,
      targetChars: 300,
    } as CloudRun);

    demoProfiles.set(userId, {
      $id: userId,
      $collectionId: "profiles",
      $databaseId: "codey",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      $permissions: [],
      $sequence: String(i + 1),
      displayName: DEMO_NAMES[i],
      githubUsername: DEMO_NAMES[i].toLowerCase(),
      avatarUrl: DEMO_AVATARS[i],
      currentStreak: Math.floor(Math.random() * 30),
      bestStreak: Math.floor(Math.random() * 60),
    } as CloudProfile);
  }

  return { runs: demoRuns, profiles: demoProfiles };
}

const RANK_COLORS = { 1: "#f5b400", 2: "#c3cad6", 3: "#d08a4c" } as const;

function PodiumCard({ run, rank, profile, name, isMe, onShare }: {
  run: CloudRun;
  rank: 1 | 2 | 3;
  profile?: CloudProfile;
  name: string;
  isMe: boolean;
  onShare: () => void;
}) {
  return (
    <article
      className="group relative flex flex-col items-center rounded-xl border bg-card/90 px-2 py-2.5 text-center shadow-lg sm:px-3"
      style={{ borderColor: `${RANK_COLORS[rank]}66`, boxShadow: `0 10px 30px -12px ${RANK_COLORS[rank]}66` }}
    >
      <Link to={`/profile/${run.userId}`} className="flex min-w-0 max-w-full flex-col items-center">
        <div
          className="grid size-10 place-items-center overflow-hidden rounded-full bg-muted text-sm font-bold ring-2 sm:size-11"
          style={{ ["--tw-ring-color" as string]: RANK_COLORS[rank] }}
        >
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-full object-cover" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
        </div>
        <p className="mt-1.5 max-w-full truncate text-xs font-bold sm:text-sm">
          {name}
          {isMe && <span className="ml-1 text-[9px] font-black uppercase text-amber-500">you</span>}
        </p>
      </Link>
      <div className="mt-1 hidden sm:block">
        <DivisionBadge bestWpm={run.wpm} avgAccuracy={run.accuracy} size="sm" />
      </div>
      <p className="mt-1 font-mono text-lg font-black tabular-nums tracking-tight sm:text-xl" style={{ color: rank === 1 ? RANK_COLORS[1] : undefined }}>
        {run.wpm.toFixed(1)}
        <span className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">wpm</span>
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {run.accuracy.toFixed(1)}% · <span className="capitalize">{run.language}</span>
      </p>
      {isMe && (
        <button
          type="button"
          onClick={onShare}
          className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Share rank ${rank}`}
        >
          <Share2 className="size-3" />
        </button>
      )}
    </article>
  );
}

/** Sticky summary of where the signed-in typist stands on this board. */
function YourRankBar({ runs, userId }: { runs: CloudRun[]; userId?: string }) {
  if (!userId) return null;
  const index = runs.findIndex((run) => run.userId === userId);
  if (index === -1) {
    return (
      <div className="leaderboard-you-bar sticky bottom-[76px] z-20 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 text-xs shadow-xl backdrop-blur-md">
        <span className="text-muted-foreground">You're not on this board yet.</span>
        <Link to="/" className="rounded-lg bg-foreground px-3 py-1.5 font-bold text-background transition-opacity hover:opacity-85">Play ranked</Link>
      </div>
    );
  }
  const rank = index + 1;
  const mine = runs[index];
  const ahead = index > 0 ? runs[index - 1] : null;
  const gap = ahead ? Math.max(0.1, ahead.wpm - mine.wpm) : 0;
  const jump = () => {
    const target = rank <= 3 ? document.querySelector(".podium-3d, .leaderboard-podium") : document.getElementById(`leaderboard-rank-${rank}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="leaderboard-you-bar sticky bottom-[76px] z-20 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <RankMark rank={rank} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          You're #{rank} <span className="font-mono font-black tabular-nums">· {mine.wpm.toFixed(1)} WPM</span>
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {ahead ? `${gap.toFixed(1)} WPM behind #${rank - 1}. One clean run could do it.` : "You hold the top spot. Defend it!"}
        </p>
      </div>
      <button type="button" onClick={jump} className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-muted">
        <ArrowDown className="size-3.5" /> Show me
      </button>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board>("snippet");
  const [language, setLanguage] = useState("All");
  const [snippetLength, setSnippetLength] = useState<SnippetLength>("medium");
  const [duration, setDuration] = useState(30);
  const [runs, setRuns] = useState<CloudRun[]>([]);
  const [profiles, setProfiles] = useState<Map<string, CloudProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [shareOptions, setShareOptions] = useState<ShareCardOptions | null>(null);
  const languages = useMemo(() => getLanguages(), []);
  useEffect(() => {
    let cancelled = false;
    if (DEMO_MODE) {
      setLoading(true);
      setTimeout(() => {
        const demo = generateDemoRuns();
        setRuns(demo.runs);
        setProfiles(demo.profiles);
        setLoading(false);
      }, 400);
      return;
    }

    setLoading(true);
    setError(false);
    setErrorMessage("");
    void getLeaderboardView({
      language,
      mode: board,
      snippetLength: board === "snippet" ? snippetLength : undefined,
      durationSeconds: board === "timed" ? duration : undefined,
      verifiedOnly: true,
    })
      .then(({ runs: nextRuns, profiles: nextProfiles }) => {
        if (cancelled) return;
        setRuns(nextRuns);
        setProfiles(nextProfiles);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("Unable to load leaderboard", loadError);
        setError(true);
        const message = loadError instanceof Error ? loadError.message : "";
        setErrorMessage(
          message.toLowerCase().includes("forbidden")
            ? `Appwrite has not allowed ${window.location.hostname} yet. Add this hostname as an Appwrite Web Platform.`
            : "Unable to load this leaderboard category. Try refreshing in a moment."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board, language, snippetLength, duration]);

  const formatLabel = board === "snippet" ? `${snippetLength.charAt(0).toUpperCase()}${snippetLength.slice(1)} snippet` : `${duration}s timed`;
  const boardTitle = language === "All" ? `All Languages · ${formatLabel}` : `${language} · ${formatLabel}`;
  const podium = runs.slice(0, 3);
  const remaining = runs.slice(3);
  const podiumOrder = podium.length === 1 ? [podium[0]] : podium.length === 2 ? [podium[1], podium[0]] : [podium[1], podium[0], podium[2]];

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to typing
        </Link>

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Trophy className="size-3.5 text-amber-500" /> Hall of Speed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">One best score per typist, per language and format.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-amber-500" />
            <span>Ranked Runs</span>
          </div>
        </header>

        <nav className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card/65 p-1 backdrop-blur-sm" aria-label="Leaderboard category">
          {([["snippet", "Snippet", Zap], ["timed", "Timed", Timer]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBoard(value)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold transition-all active:scale-[.98] sm:text-sm ${
                board === value ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" /> <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">{boardTitle}</p>
            <p className="text-xs text-muted-foreground">
              {MIN_RANKED_ACCURACY}% accuracy · {MIN_RANKED_WPM} WPM minimum
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card/70 p-1">
              {languages.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    language === item ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card/70 p-1">
              {board === "snippet"
                ? (["short", "medium", "long"] as SnippetLength[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSnippetLength(item)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        snippetLength === item ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {item}
                    </button>
                  ))
                : [15, 30, 60, 120].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDuration(value)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        duration === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {value}s
                    </button>
                  ))}
            </div>
          </div>
        </section>

        {loading ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <div className="grid h-80 place-items-center rounded-2xl border bg-card/70 px-5 text-center text-sm text-muted-foreground">{errorMessage}</div>
        ) : runs.length === 0 ? (
          <div className="grid h-80 place-items-center rounded-2xl border bg-card/70 px-5 text-center text-sm text-muted-foreground">
            No scores for {language} on this format yet. Claim the first rank.
          </div>
        ) : (
          <main className="animate-fade-in-up space-y-6">
            <Podium3D
              entries={[...podium.map((run, index) => {
                const rank = (index + 1) as 1 | 2 | 3;
                return {
                  rank,
                  onSelect: () => navigate(`/profile/${run.userId}`),
                  card: (
                    <PodiumCard
                      run={run}
                      rank={rank}
                      profile={profiles.get(run.userId)}
                      name={displayName(run, profiles)}
                      isMe={user?.$id === run.userId}
                      onShare={() => setShareOptions({ result: cloudRunAsResult(run), username: profiles.get(run.userId)?.githubUsername || displayName(run, profiles), heading: boardTitle, rank })}
                    />
                  ),
                };
              }), ...([1, 2, 3] as const).filter((rank) => rank > podium.length).map((rank) => ({
                rank,
                empty: true,
                onSelect: () => navigate("/"),
                card: (
                  <Link to="/" className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-2 py-5 text-center text-muted-foreground transition-colors hover:text-foreground">
                    <span className="text-lg font-black">#{rank}</span>
                    <span className="text-[11px] font-semibold">Open spot</span>
                    <span className="text-[10px]">Claim it with a ranked run</span>
                  </Link>
                ),
              }))]}
              fallback={
            <section className="leaderboard-podium rounded-2xl border bg-card/65 p-3 backdrop-blur-sm sm:p-4" aria-label="Top three typists">
              <div className={`grid gap-2 sm:gap-3 ${podiumOrder.length === 1 ? "grid-cols-1 max-w-md mx-auto" : podiumOrder.length === 2 ? "grid-cols-2 max-w-2xl mx-auto" : "grid-cols-3"}`}>
                {podiumOrder.map((run, position) => {
                  const actualRank = podiumOrder.length === 1 ? 1 : podiumOrder.length === 2 ? (position === 0 ? 2 : 1) : position === 0 ? 2 : position === 1 ? 1 : 3;
                  const name = displayName(run, profiles);
                  const profile = profiles.get(run.userId);
                  const isChampion = actualRank === 1;
                  return (
                    <article
                      key={run.$id}
                      className={`leaderboard-podium-entry group relative flex flex-col items-center rounded-xl border bg-card/80 p-3 text-center transition-all hover:border-foreground/20 hover:bg-card sm:p-4 ${
                        isChampion ? "is-champion -mt-2 sm:-mt-3" : ""
                      }`}
                    >
                      <div className="mb-2">
                        <RankMark rank={actualRank} size={isChampion ? "md" : "sm"} />
                      </div>
                      <Link to={`/profile/${run.userId}`} className="relative mb-2">
                        <div
                          className={`leaderboard-podium-avatar grid place-items-center overflow-hidden rounded-full bg-muted font-bold ${
                            isChampion ? "size-14 ring-2 ring-amber-400/60" : "size-11 ring-1 ring-border"
                          }`}
                        >
                          {profile?.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span>{name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                      </Link>
                      <Link to={`/profile/${run.userId}`} className="group/link min-w-0">
                        <p className="truncate text-sm font-bold">
                          <span className="group-hover/link:text-muted-foreground transition-colors">{name}</span>
                        </p>
                      </Link>
                      <div className="mb-2 mt-1">
                        <DivisionBadge bestWpm={run.wpm} avgAccuracy={run.accuracy} size="sm" />
                      </div>
                      <div className={`${isChampion ? "text-2xl" : "text-xl"} font-black tabular-nums tracking-tight`}>{run.wpm.toFixed(1)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">WPM</div>
                      <div className="mt-2 grid w-full grid-cols-2 divide-x rounded-lg border bg-background/40 py-1.5 text-[10px] text-muted-foreground">
                        <span>
                          <b className="block text-xs text-foreground tabular-nums">{run.accuracy.toFixed(1)}%</b>acc
                        </span>
                        <span>
                          <b className="block truncate px-1 text-xs capitalize text-foreground">{run.language}</b>
                          {run.snippetLength ?? (run.durationSeconds ? `${run.durationSeconds}s` : run.mode)}
                        </span>
                      </div>
                      {user?.$id === run.userId && (
                        <button
                          type="button"
                          onClick={() => setShareOptions({ result: cloudRunAsResult(run), username: profile?.githubUsername || name, heading: boardTitle, rank: actualRank })}
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border bg-background/70 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                          aria-label={`Share rank ${actualRank}`}
                        >
                          <Share2 className="size-3" />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
              }
            />

            {/* Compact Ranking List */}
            {remaining.length > 0 && (
              <section className="overflow-hidden rounded-2xl border bg-card/80">
                <div className="grid grid-cols-[40px_1fr_70px_70px] items-center gap-3 border-b bg-muted/45 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:grid-cols-[48px_1fr_90px_90px_90px]">
                  <span>#</span>
                  <span>Typist</span>
                  <span className="hidden sm:block">Run</span>
                  <span className="text-right">WPM</span>
                  <span className="text-right">Accuracy</span>
                </div>
                {remaining.map((run, index) => {
                  const name = displayName(run, profiles);
                  const profile = profiles.get(run.userId);
                  const canShare = user?.$id === run.userId;
                  const rank = index + 4;
                  return (
                    <div
                      key={run.$id}
                      id={`leaderboard-rank-${rank}`}
                      className={`group grid scroll-mt-24 grid-cols-[40px_1fr_70px_70px] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/30 sm:grid-cols-[48px_1fr_90px_90px_90px] ${canShare ? "leaderboard-row-me" : ""}`}
                    >
                      <RankMark rank={rank} size="sm" />
                      <Link to={`/profile/${run.userId}`} className="flex min-w-0 items-center gap-2.5">
                        <div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-[10px] font-bold">
                          {profile?.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
                          ) : (
                            name.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="truncate text-sm font-medium">{name}</p>
                            {canShare && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-500">You</span>}
                            <DivisionBadge bestWpm={run.wpm} avgAccuracy={run.accuracy} size="sm" />
                          </div>
                        </div>
                      </Link>
                      <div className="hidden min-w-0 sm:block">
                        <p className="truncate text-xs font-medium">{run.language}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {run.snippetLength ?? run.mode}
                          {run.durationSeconds ? ` · ${run.durationSeconds}s` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold tabular-nums">{run.wpm.toFixed(1)}</p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-medium tabular-nums">{run.accuracy.toFixed(1)}%</span>
                        {canShare && (
                          <button
                            type="button"
                            onClick={() => setShareOptions({ result: cloudRunAsResult(run), username: profile?.githubUsername || name, heading: boardTitle, rank })}
                            className="grid size-7 place-items-center rounded-md border text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                            aria-label={`Share rank ${rank}`}
                          >
                            <Share2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            <YourRankBar runs={runs} userId={user?.$id} />
          </main>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">Only anti-cheat verified ranked runs appear here. Scores are public.</p>
      </div>
      <Footer />
      <SharePreviewDialog options={shareOptions} onClose={() => setShareOptions(null)} />
    </div>
  );
}
