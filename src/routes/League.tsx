import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Loader2, Medal, Minus, Rss, Search, Shield, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/social/FollowButton";
import { useAuth } from "@/components/AuthProvider";
import { Kap3D } from "@/components/streak/Kap3D";
import { KapMascot } from "@/components/streak/KapMascot";
import { useKapLook } from "@/hooks/useKapLook";
import { useStreak } from "@/hooks/useStreak";
import { FLAME_TIERS } from "@/lib/streak";
import { cn } from "@/lib/utils";
import {
  ago,
  DIVISION_COLORS,
  DIVISION_TEXT,
  DIVISIONS,
  fetchFeed,
  fetchFriends,
  fetchLeague,
  searchPlayers,
  timeLeft,
  zoneOf,
  type FeedItem,
  type FriendRow,
  type LeagueView,
  type PublicPlayer,
} from "@/lib/social";

type Tab = "league" | "friends" | "feed";

function Avatar({ player, size = 32 }: { player: Pick<PublicPlayer, "name" | "avatarUrl">; size?: number }) {
  return player.avatarUrl ? (
    <img src={player.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full border object-cover" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground" style={{ width: size, height: size }}>
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border bg-card/80 p-4 sm:p-5", className)}>{children}</section>;
}

function useCountdown(until: string | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return until ? timeLeft(until) : "";
}

/* ---- League tab ---- */

function LastWeekBanner({ lastWeek }: { lastWeek: NonNullable<LeagueView["lastWeek"]> }) {
  const up = lastWeek.result === "up";
  const down = lastWeek.result === "down";
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-sm", up ? "border-emerald-500/40 bg-emerald-500/10" : down ? "border-rose-500/40 bg-rose-500/10" : "bg-muted/40")}>
      <Icon className={cn("size-4 shrink-0", up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground")} />
      <p>
        <span className="font-semibold">
          {up ? `Promoted to ${DIVISIONS[lastWeek.to]}!` : down ? `Moved down to ${DIVISIONS[lastWeek.to]}.` : `Stayed in ${DIVISIONS[lastWeek.to]}.`}
        </span>{" "}
        <span className="text-muted-foreground">{lastWeek.rank ? `You finished #${lastWeek.rank} last week.` : "Last week is settled."}</span>
      </p>
    </div>
  );
}

function Standings({ view, meId }: { view: LeagueView; meId: string }) {
  const size = view.standings.length;
  return (
    <ol className="divide-y overflow-hidden rounded-xl border">
      {view.standings.map((row) => {
        const zone = zoneOf(row.rank, size, view.rules);
        const me = row.userId === meId;
        const firstDemote = view.rules.demote && row.rank === size - view.rules.demote + 1;
        return (
          <li key={row.userId} className={cn(firstDemote && "border-t-2 border-t-rose-500/50")}>
            <Link
              to={`/profile/${encodeURIComponent(row.userId)}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                me && "bg-amber-500/10",
                zone === "promote" && "border-l-4 border-l-emerald-500",
                zone === "demote" && "border-l-4 border-l-rose-500",
                zone === "safe" && "border-l-4 border-l-transparent",
              )}
            >
              <span className={cn("w-6 text-right font-mono text-sm font-bold tabular-nums", zone === "promote" ? "text-emerald-500" : zone === "demote" ? "text-rose-500" : "text-muted-foreground")}>{row.rank}</span>
              <Avatar player={row} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {row.name}
                {me && <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">(you)</span>}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums">{row.xp.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">XP</span></span>
            </Link>
            {view.rules.promote > 0 && row.rank === view.rules.promote && size > view.rules.promote && (
              <p className="flex items-center gap-1.5 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="size-3" /> Promotion zone: top {view.rules.promote} move up to {DIVISIONS[view.division + 1]}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function LeagueTab({ view, meId }: { view: LeagueView; meId: string }) {
  const look = useKapLook();
  const streak = useStreak();
  const tier = streak.tier ?? FLAME_TIERS[1];
  const left = useCountdown(view.endsAt);
  const color = DIVISION_COLORS[view.division];
  const me = view.standings.find((row) => row.userId === meId);
  const medalLook = { ...look, medal: view.division };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Panel className="relative self-start overflow-hidden text-center">
        <div className="pointer-events-none absolute left-1/2 top-6 size-44 -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: color }} aria-hidden />
        <Kap3D mood="lit" tier={tier} look={medalLook} height={190} className="relative w-full" fallback={<KapMascot mood="lit" tier={tier} look={medalLook} size={140} />} />
        <p className={cn("relative mt-1 flex items-center justify-center gap-1.5 text-lg font-black tracking-tight", DIVISION_TEXT[view.division])}>
          <Shield className="size-5" /> {view.divisionName} league
        </p>
        <p className="relative text-xs text-muted-foreground">Ends in {left}</p>
        <div className="relative mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border bg-background/60 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">This week</p>
            <p className="font-mono text-xl font-black tabular-nums">{me?.xp ?? 0}<span className="text-xs font-semibold text-muted-foreground"> XP</span></p>
          </div>
          <div className="rounded-xl border bg-background/60 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rank</p>
            <p className="font-mono text-xl font-black tabular-nums">{me ? `#${me.rank}` : "-"}</p>
          </div>
        </div>
        <ol className="relative mt-4 flex justify-center gap-1.5" aria-label="Divisions">
          {DIVISIONS.map((name, index) => (
            <li key={name} title={name} className={cn("grid size-8 place-items-center rounded-full border-2", index === view.division ? "scale-110" : "opacity-40")} style={{ borderColor: DIVISION_COLORS[index], color: DIVISION_COLORS[index] }}>
              <Medal className="size-4" />
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex min-w-0 flex-col gap-3">
        {view.lastWeek && <LastWeekBanner lastWeek={view.lastWeek} />}
        {view.joined ? (
          <Panel className="p-0 sm:p-0">
            <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-5">
              <h2 className="text-sm font-bold">This week's group</h2>
              <p className="text-xs text-muted-foreground">{view.standings.length} of {view.rules.groupSize} players</p>
            </div>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
              <Standings view={view} meId={meId} />
            </div>
          </Panel>
        ) : (
          <Panel className="text-center">
            <p className="text-base font-bold">Finish a run to join this week's league</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Every run earns XP: about one point for every ten correct characters, less when accuracy drops, and 1.5× for verified Ranked runs. You'll join a group of up to {view.rules.groupSize} {view.divisionName} players.
            </p>
            <Button asChild className="mt-4"><Link to="/">Start practicing</Link></Button>
          </Panel>
        )}
        <p className="px-1 text-[11px] text-muted-foreground">
          Top {5} move up a division each week, the bottom {5} move down (in groups of 10 or more). XP is capped at 800 a day, so steady practice beats one marathon.
        </p>
      </div>
    </div>
  );
}

/* ---- Friends tab ---- */

function FindPlayers({ onFollowed }: { onFollowed: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(PublicPlayer & { isFollowing: boolean })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.replace(/^@/, "").length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchPlayers(q).then((result) => setResults(result.results), () => setResults([])).finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Panel>
      <h2 className="text-sm font-bold">Find friends</h2>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="GitHub username or name"
          className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-amber-500/70"
          aria-label="Search players"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y rounded-xl border">
          {results.map((player) => (
            <li key={player.userId} className="flex items-center gap-3 px-3 py-2">
              <Avatar player={player} />
              <Link to={`/profile/${encodeURIComponent(player.userId)}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {player.name} {player.username && <span className="font-normal text-muted-foreground">@{player.username}</span>}
              </Link>
              <FollowButton userId={player.userId} initial={player.isFollowing} onChange={onFollowed} />
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !loading && !results.length && <p className="mt-2 text-xs text-muted-foreground">Nobody by that name yet.</p>}
    </Panel>
  );
}

function FriendsTab() {
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    void fetchFriends().then((result) => setRows(result.rows), (reason: Error) => setError(reason.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Panel className="p-0 sm:p-0">
        <div className="px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-sm font-bold">You and your friends this week</h2>
          <p className="text-xs text-muted-foreground">By league XP, with each player's best speed this week.</p>
        </div>
        {error ? (
          <p className="px-5 pb-5 text-sm text-rose-500">{error}</p>
        ) : !rows ? (
          <div className="grid place-items-center pb-8 pt-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ol className="divide-y border-t">
            {rows.map((row, index) => (
              <li key={row.userId}>
                <Link to={`/profile/${encodeURIComponent(row.userId)}`} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50 sm:px-5", row.you && "bg-amber-500/10")}>
                  <span className="w-5 text-right font-mono text-sm font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                  <Avatar player={row} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{row.name}{row.you && <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">(you)</span>}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {row.division !== null ? `${DIVISIONS[row.division]} league` : "Not in a league this week"}
                      {row.bestWpm ? ` · best ${Math.round(row.bestWpm)} WPM${row.bestLanguage ? ` in ${row.bestLanguage}` : ""}` : ""}
                    </span>
                  </span>
                  <span className="font-mono font-bold tabular-nums">{row.xp} <span className="text-xs font-normal text-muted-foreground">XP</span></span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        {rows && rows.length === 1 && <p className="px-5 py-4 text-sm text-muted-foreground">Follow people to race them here. Find them on the right, or from any profile.</p>}
      </Panel>
      <FindPlayers onFollowed={load} />
    </div>
  );
}

/* ---- Feed tab ---- */

function FeedTab() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetchFeed().then((result) => setItems(result.items), (reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Panel><p className="text-sm text-rose-500">{error}</p></Panel>;
  if (!items) return <Panel className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></Panel>;
  if (!items.length) {
    return (
      <Panel className="text-center">
        <p className="font-bold">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Runs from people you follow show up here.</p>
      </Panel>
    );
  }
  return (
    <Panel className="p-0 sm:p-0">
      <ol className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Avatar player={item.player} size={36} />
            <p className="min-w-0 flex-1 text-sm">
              <Link to={`/profile/${encodeURIComponent(item.player.userId)}`} className="font-semibold hover:underline">{item.player.name}</Link>{" "}
              <span className="text-muted-foreground">typed</span>{" "}
              <span className="font-mono font-bold">{Math.round(item.wpm)} WPM</span>{" "}
              <span className="text-muted-foreground">in {item.language} · {item.accuracy.toFixed(1)}%</span>
              {item.verified && <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Ranked</span>}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{ago(item.at)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ---- Page ---- */

export default function League() {
  const { user, login, configured } = useAuth();
  const [tab, setTab] = useState<Tab>(() => (["friends", "feed"].includes(window.location.hash.slice(1)) ? (window.location.hash.slice(1) as Tab) : "league"));
  const [view, setView] = useState<LeagueView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetchLeague().then(setView, (reason: Error) => setError(reason.message));
  }, [user]);

  useEffect(() => {
    window.history.replaceState(null, "", tab === "league" ? window.location.pathname : `#${tab}`);
  }, [tab]);

  const tabs = useMemo(() => [
    { id: "league" as const, label: "League", icon: Shield },
    { id: "friends" as const, label: "Friends", icon: Users },
    { id: "feed" as const, label: "Feed", icon: Rss },
  ], []);

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <header className="mb-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
            <Medal className="size-3.5" /> Weekly league
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">League</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Practice earns XP. Every week, the top of your group moves up a division: Bronze, Silver, Gold, Diamond.</p>
        </header>

        {!user ? (
          <Panel className="text-center">
            <p className="text-base font-bold">Sign in to join the league</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Your runs earn XP each week, and you can follow friends to race them.</p>
            <Button type="button" className="mt-4" onClick={login} disabled={!configured}>Sign in with GitHub</Button>
          </Panel>
        ) : (
          <>
            <div className="mb-4 inline-flex rounded-xl border bg-card/80 p-1" role="tablist">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer", tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
            {tab === "league" && (error ? <Panel><p className="text-sm text-rose-500">{error}</p></Panel> : view ? <LeagueTab view={view} meId={user.$id} /> : <Panel className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></Panel>)}
            {tab === "friends" && <FriendsTab />}
            {tab === "feed" && <FeedTab />}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

