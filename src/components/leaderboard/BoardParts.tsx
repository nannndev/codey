import { Link } from "react-router-dom";
import { ArrowDown, Share2 } from "lucide-react";
import type { CloudProfile } from "@/lib/cloud";
import { RankMark } from "@/components/RankMark";
import { DivisionBadge } from "@/components/DivisionBadge";

/** The fields every board row has, whether a ranked run or a daily best. */
export interface BoardEntry {
  $id: string;
  userId: string;
  wpm: number;
  accuracy: number;
  language: string;
}

export const RANK_COLORS = { 1: "#f5b400", 2: "#c3cad6", 3: "#d08a4c" } as const;

export function PodiumCard({ run, rank, profile, name, isMe, onShare }: {
  run: BoardEntry;
  rank: 1 | 2 | 3;
  profile?: CloudProfile;
  name: string;
  isMe: boolean;
  /** Omit to hide the share button. */
  onShare?: () => void;
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
      {isMe && onShare && (
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
export function YourRankBar({ runs, userId, ctaLabel = "Play ranked", ctaTo = "/" }: {
  runs: BoardEntry[];
  userId?: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  if (!userId) return null;
  const index = runs.findIndex((run) => run.userId === userId);
  if (index === -1) {
    return (
      <div className="leaderboard-you-bar sticky bottom-[76px] z-20 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 text-xs shadow-xl backdrop-blur-md">
        <span className="text-muted-foreground">You're not on this board yet.</span>
        <Link to={ctaTo} className="rounded-lg bg-foreground px-3 py-1.5 font-bold text-background transition-opacity hover:opacity-85">{ctaLabel}</Link>
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
