import type { StreakData } from "@/utils/storage";

/**
 * Streak state for Kap, the keycap mascot: whether today is done, how big the
 * flame is, the next milestone and the last seven days. Pure, so it is easy to
 * test; callers pass in the stored streak and the days runs were finished.
 */

export type StreakMood = "sleep" | "risk" | "lit" | "frozen";

export interface FlameTier {
  id: "spark" | "flame" | "blaze" | "blue" | "legend";
  name: string;
  /** Days needed to reach this flame. */
  min: number;
  /** Flame height relative to the "blaze" flame. */
  scale: number;
  flame: string;
  core: string;
  /** Keycap colours when lit: top face, front skirt, sides and arms. */
  cap: [string, string, string];
  crown?: boolean;
}

export const FLAME_TIERS: FlameTier[] = [
  { id: "spark", name: "Spark", min: 1, scale: 0.6, flame: "#f97316", core: "#fed7aa", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "flame", name: "Flame", min: 3, scale: 0.8, flame: "#f59e0b", core: "#fef3c7", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "blaze", name: "Blaze", min: 7, scale: 1, flame: "#f59e0b", core: "#fef3c7", cap: ["#fde68a", "#fbbf24", "#d97706"] },
  { id: "blue", name: "Blue fire", min: 30, scale: 1.08, flame: "#3b82f6", core: "#dbeafe", cap: ["#e0f2fe", "#7dd3fc", "#0284c7"] },
  { id: "legend", name: "Legend", min: 100, scale: 1.2, flame: "#a855f7", core: "#f3e8ff", cap: ["#ede9fe", "#c4b5fd", "#8b5cf6"], crown: true },
];

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];

export function tierFor(days: number): FlameTier | null {
  let tier: FlameTier | null = null;
  for (const candidate of FLAME_TIERS) if (days >= candidate.min) tier = candidate;
  return tier;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shift(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

/* ---- Streak freeze: one missed day per week is forgiven ---- */

export const FREEZE_STORAGE_KEY = "codey_streak_freezes";
export const FREEZES_PER_WEEK = 1;

/** The Monday a date's week starts on, as a date key. */
export function weekOf(key: string) {
  const date = new Date(`${key}T12:00:00`);
  const monday = shift(date, -((date.getDay() + 6) % 7));
  return dateKey(monday);
}

/**
 * The missed days between the last practice and today that freezes can
 * cover, or null when there are more misses than freezes. An empty list
 * means nothing was missed.
 */
export function coverGap(lastDate: string, today: string, used: readonly string[]): string[] | null {
  if (!lastDate || lastDate >= today) return [];
  const covered: string[] = [];
  const spent = new Map<string, number>();
  for (const day of used) spent.set(weekOf(day), (spent.get(weekOf(day)) ?? 0) + 1);
  let day = dateKey(shift(new Date(`${lastDate}T12:00:00`), 1));
  while (day < today) {
    const week = weekOf(day);
    const count = spent.get(week) ?? 0;
    if (count >= FREEZES_PER_WEEK) return null;
    spent.set(week, count + 1);
    covered.push(day);
    day = dateKey(shift(new Date(`${day}T12:00:00`), 1));
  }
  return covered;
}

export function readFreezes(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FREEZE_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)) : [];
  } catch {
    return [];
  }
}

export function writeFreezes(days: string[]) {
  try {
    localStorage.setItem(FREEZE_STORAGE_KEY, JSON.stringify([...new Set(days)].sort().slice(-30)));
  } catch {
    // The streak itself is already saved.
  }
}

export interface StreakDay {
  key: string;
  /** Short weekday, e.g. "Mon". */
  label: string;
  practiced: boolean;
  /** Missed, but a freeze covered it (or will, at the next run). */
  frozen: boolean;
  today: boolean;
}

export interface StreakStatus {
  /** Days in a row, counting today or yesterday; 0 once a day was missed. */
  current: number;
  best: number;
  practicedToday: boolean;
  mood: StreakMood;
  tier: FlameTier | null;
  /** The streak that ended, when the last one was missed; 0 otherwise. */
  lost: number;
  nextMilestone: number;
  /** 0-1 from the previous milestone to the next. */
  progress: number;
  week: StreakDay[];
  /** A freeze is still free this week. */
  freezeReady: boolean;
  /** Missed days a freeze is holding, waiting for today's run. */
  frozenDays: string[];
}

export function streakStatus(streak: StreakData, practicedDays: Iterable<string>, now = new Date(), freezes: readonly string[] = []): StreakStatus {
  const today = dateKey(now);
  const yesterday = dateKey(shift(now, -1));
  const practicedToday = streak.lastDate === today;
  // Days missed since the last run that freezes can still hold.
  const pending = streak.lastDate && streak.lastDate < yesterday && streak.current > 0 ? coverGap(streak.lastDate, today, freezes) : [];
  const alive = streak.lastDate === today || streak.lastDate === yesterday || (pending !== null && pending.length > 0);
  const current = alive ? Math.max(0, streak.current) : 0;
  const frozenDays = alive && pending ? pending : [];
  const frozenAll = new Set([...freezes, ...frozenDays]);
  const days = new Set(practicedDays);
  // A synced streak can come from another device; its days count as practiced too.
  if (alive && streak.lastDate) {
    const last = new Date(`${streak.lastDate}T12:00:00`);
    for (let index = 0, counted = 0; counted < Math.min(current, 7) && index < 30; index += 1) {
      const key = dateKey(shift(last, -index));
      if (frozenAll.has(key)) continue;
      days.add(key);
      counted += 1;
    }
  }
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > current) ?? Math.ceil((current + 1) / 1000) * 1000;
  const previous = [...STREAK_MILESTONES].reverse().find((milestone) => milestone <= current) ?? 0;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shift(now, index - 6);
    const key = dateKey(date);
    return { key, label: date.toLocaleDateString("en-US", { weekday: "short" }), practiced: days.has(key), frozen: !days.has(key) && frozenAll.has(key), today: key === today };
  });
  const thisWeek = weekOf(today);
  const spentThisWeek = [...frozenAll].filter((day) => weekOf(day) === thisWeek).length;
  return {
    current,
    best: Math.max(streak.best, current),
    practicedToday,
    mood: current === 0 ? "sleep" : practicedToday ? "lit" : frozenDays.length ? "frozen" : "risk",
    tier: tierFor(current),
    lost: alive ? 0 : Math.max(0, streak.current),
    nextMilestone,
    progress: Math.max(0, Math.min(1, (current - previous) / (nextMilestone - previous))),
    week,
    freezeReady: spentThisWeek < FREEZES_PER_WEEK,
    frozenDays,
  };
}

/** What Kap says, by state. */
export function streakMessage(status: StreakStatus): { title: string; body: string } {
  if (status.mood === "sleep") {
    return status.lost > 1
      ? { title: `Your ${status.lost}-day streak ended`, body: "Kap fell asleep. Finish one run today to light a new flame." }
      : { title: "Kap is asleep", body: "Finish one run today to light your first flame." };
  }
  if (status.mood === "frozen") {
    return { title: "A freeze saved your streak", body: `You missed ${status.frozenDays.length === 1 ? "a day" : `${status.frozenDays.length} days`}, so Kap wrapped up warm. Practice today to keep your ${status.current}-day streak.` };
  }
  if (status.mood === "risk") {
    return { title: `Keep your ${status.current}-day streak alive`, body: "You haven't practiced today yet. One run keeps the flame burning." };
  }
  const left = status.nextMilestone - status.current;
  return {
    title: `${status.current}-day streak`,
    body: `Done for today. ${left} more ${left === 1 ? "day" : "days"} to reach ${status.nextMilestone}.`,
  };
}

/** Streak days a finished run moved from, and to, for the celebration. */
export interface StreakChange {
  from: number;
  to: number;
  milestone: boolean;
}

export function isMilestone(days: number) {
  return STREAK_MILESTONES.includes(days);
}
