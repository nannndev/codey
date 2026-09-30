import { apiError, getJwtToken, rankedApiUrl } from "./ranked";

/** Client for /api/social: weekly leagues, follows, the friends board and feed. */

export const DIVISIONS = ["Bronze", "Silver", "Gold", "Diamond"] as const;
export const DIVISION_COLORS = ["#d97706", "#94a3b8", "#facc15", "#67e8f9"] as const;
/** Readable text colours per division, in both themes. */
export const DIVISION_TEXT = ["text-amber-700 dark:text-amber-400", "text-slate-500 dark:text-slate-300", "text-yellow-600 dark:text-yellow-300", "text-cyan-700 dark:text-cyan-300"] as const;
export const LEAGUE_XP_EVENT = "codey:league-xp";

export interface LeagueStanding {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  xp: number;
}

export interface LeagueView {
  week: string;
  endsAt: string;
  division: number;
  divisionName: string;
  bestDivision: number;
  joined: boolean;
  standings: LeagueStanding[];
  rules: { groupSize: number; promote: number; demote: number };
  lastWeek: { week: string; result: "up" | "down" | "stay" | string; rank: number; from: number; to: number } | null;
}

export interface PublicPlayer {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface FriendRow extends PublicPlayer {
  you: boolean;
  xp: number;
  division: number | null;
  bestWpm: number | null;
  bestLanguage: string | null;
}

export interface FeedItem {
  id: string;
  at: string;
  wpm: number;
  accuracy: number;
  language: string;
  mode: string;
  verified: boolean;
  player: PublicPlayer;
}

export interface XpGain {
  gained: number;
  weekXp?: number;
  division?: number;
}

async function call<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const jwt = await getJwtToken();
  if (options.auth !== false && !jwt) throw new Error("Sign in with GitHub first.");
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(rankedApiUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) throw await apiError(response, "Something went wrong. Try again shortly.");
  return response.json() as Promise<T>;
}

export const fetchLeague = () => call<LeagueView>("/api/social/league");
export const fetchFriends = () => call<{ week: string; rows: FriendRow[]; following: number }>("/api/social/friends");
export const fetchFeed = () => call<{ items: FeedItem[] }>("/api/social/feed");
export const searchPlayers = (q: string) => call<{ results: (PublicPlayer & { isFollowing: boolean })[] }>(`/api/social/search?q=${encodeURIComponent(q)}`, { auth: false });
export const fetchRelation = (userId: string) => call<{ followers: number; following: number; isFollowing: boolean }>(`/api/social/relation?userId=${encodeURIComponent(userId)}`, { auth: false });
export const followPlayer = (userId: string) => call<{ following: boolean }>("/api/social/follow", { method: "POST", body: { userId } });
export const unfollowPlayer = (userId: string) => call<{ following: boolean }>("/api/social/unfollow", { method: "POST", body: { userId } });

/**
 * Counts a stored run towards this week's league and tells the results
 * screen how much it earned. Quiet on failure: XP is a bonus, not the run.
 */
export async function awardLeagueXp(runId: string): Promise<XpGain | null> {
  try {
    const gain = await call<XpGain>("/api/social/xp", { method: "POST", body: { runId } });
    window.dispatchEvent(new CustomEvent<XpGain>(LEAGUE_XP_EVENT, { detail: gain }));
    return gain;
  } catch (error) {
    console.warn("League XP was not counted:", error);
    return null;
  }
}

/** "3d 4h", "5h 12m", "18m" until a moment. */
export function timeLeft(until: string, now = Date.now()): string {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/** Which zone a rank sits in, for colouring the standings. */
export function zoneOf(rank: number, size: number, rules: LeagueView["rules"]): "promote" | "demote" | "safe" {
  if (rules.promote && rank <= rules.promote) return "promote";
  if (rules.demote && rank > size - rules.demote) return "demote";
  return "safe";
}

/** "2h ago", "3d ago". */
export function ago(at: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
