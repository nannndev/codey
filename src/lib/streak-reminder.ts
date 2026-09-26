import { dateKey, type StreakStatus } from "./streak";

/**
 * Evening streak reminders from Kap. Codey has no push server, so they fire
 * while a Codey tab is open (a pinned tab is enough): at the chosen hour, once
 * a day, only when today's run is still missing.
 */

export const REMINDER_STORAGE_KEY = "codey_streak_reminder";
const NOTIFIED_KEY = "codey_streak_reminded_on";
export const REMINDER_HOURS = [17, 18, 19, 20, 21, 22];

export interface ReminderSettings {
  enabled: boolean;
  /** Local hour, 0-23. */
  hour: number;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20 };
export const REMINDER_EVENT = "codey:reminder-changed";

export function readReminder(): ReminderSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) ?? "null") as Partial<ReminderSettings> | null;
    if (!parsed) return DEFAULT_REMINDER;
    return { enabled: parsed.enabled === true, hour: REMINDER_HOURS.includes(Number(parsed.hour)) ? Number(parsed.hour) : DEFAULT_REMINDER.hour };
  } catch {
    return DEFAULT_REMINDER;
  }
}

export function writeReminder(settings: ReminderSettings) {
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // A convenience only.
  }
  window.dispatchEvent(new CustomEvent(REMINDER_EVENT));
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Asks for permission if needed; true when reminders can be shown. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Whether a reminder is due right now. */
export function reminderDue(settings: ReminderSettings, status: Pick<StreakStatus, "current" | "practicedToday">, now: Date, lastNotified: string | null) {
  if (!settings.enabled || status.practicedToday || status.current <= 0) return false;
  if (now.getHours() < settings.hour) return false;
  return lastNotified !== dateKey(now);
}

export function reminderMessage(status: Pick<StreakStatus, "current" | "mood">) {
  return status.mood === "frozen"
    ? { title: "Kap is keeping your streak warm", body: `Your freeze saved yesterday. One run today keeps your ${status.current}-day streak.` }
    : { title: `Your ${status.current}-day streak ends at midnight`, body: "Kap is worried. One quick run keeps the flame burning." };
}

export function lastNotifiedOn(): string | null {
  try {
    return localStorage.getItem(NOTIFIED_KEY);
  } catch {
    return null;
  }
}

export function markNotified(now: Date) {
  try {
    localStorage.setItem(NOTIFIED_KEY, dateKey(now));
  } catch {
    // Worst case one extra reminder.
  }
}
