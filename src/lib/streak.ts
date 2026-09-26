import type { StreakData } from "@/utils/storage";

/**
 * Streak state for Kap, the keycap mascot: whether today is done, how big the
 * flame is, the next milestone and the last seven days. Pure, so it is easy to
 * test; callers pass in the stored streak and the days runs were finished.
 */

export type StreakMood = "sleep" | "risk" | "lit";

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

export interface StreakDay {
  key: string;
  /** Short weekday, e.g. "Mon". */
  label: string;
  practiced: boolean;
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
}

export function streakStatus(streak: StreakData, practicedDays: Iterable<string>, now = new Date()): StreakStatus {
  const today = dateKey(now);
  const yesterday = dateKey(shift(now, -1));
  const alive = streak.lastDate === today || streak.lastDate === yesterday;
  const current = alive ? Math.max(0, streak.current) : 0;
  const practicedToday = streak.lastDate === today;
  const days = new Set(practicedDays);
  // A synced streak can come from another device; its days count as practiced too.
  if (alive && streak.lastDate) {
    const last = new Date(`${streak.lastDate}T12:00:00`);
    for (let index = 0; index < Math.min(current, 7); index += 1) days.add(dateKey(shift(last, -index)));
  }
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > current) ?? Math.ceil((current + 1) / 1000) * 1000;
  const previous = [...STREAK_MILESTONES].reverse().find((milestone) => milestone <= current) ?? 0;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shift(now, index - 6);
    const key = dateKey(date);
    return { key, label: date.toLocaleDateString("en-US", { weekday: "short" }), practiced: days.has(key), today: key === today };
  });
  return {
    current,
    best: Math.max(streak.best, current),
    practicedToday,
    mood: current === 0 ? "sleep" : practicedToday ? "lit" : "risk",
    tier: tierFor(current),
    lost: alive ? 0 : Math.max(0, streak.current),
    nextMilestone,
    progress: Math.max(0, Math.min(1, (current - previous) / (nextMilestone - previous))),
    week,
  };
}

/** What Kap says, by state. */
export function streakMessage(status: StreakStatus): { title: string; body: string } {
  if (status.mood === "sleep") {
    return status.lost > 1
      ? { title: `Your ${status.lost}-day streak ended`, body: "Kap fell asleep. Finish one run today to light a new flame." }
      : { title: "Kap is asleep", body: "Finish one run today to light your first flame." };
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
