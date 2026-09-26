import { describe, expect, it } from "vitest";
import { dateKey, isMilestone, streakMessage, streakStatus, tierFor } from "./streak";

const NOW = new Date(2026, 8, 26, 15, 0, 0); // Sat 26 Sep 2026, local time
const day = (offset: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
};

describe("streakStatus", () => {
  it("is lit once today is done", () => {
    const status = streakStatus({ current: 12, best: 20, lastDate: day(0) }, [], NOW);
    expect(status).toMatchObject({ current: 12, best: 20, practicedToday: true, mood: "lit", lost: 0, nextMilestone: 14 });
    expect(status.tier?.id).toBe("blaze");
    expect(status.progress).toBeCloseTo(5 / 7);
  });

  it("is at risk when yesterday was the last day", () => {
    const status = streakStatus({ current: 5, best: 5, lastDate: day(-1) }, [], NOW);
    expect(status).toMatchObject({ current: 5, practicedToday: false, mood: "risk" });
    expect(streakMessage(status).title).toBe("Keep your 5-day streak alive");
  });

  it("drops to zero after more missed days than a freeze covers, and remembers what was lost", () => {
    // Wed 23 was the last run; Thu and Fri were both missed in the same week.
    const status = streakStatus({ current: 9, best: 9, lastDate: day(-3) }, [], NOW);
    expect(status).toMatchObject({ current: 0, best: 9, mood: "sleep", lost: 9, tier: null });
    expect(streakMessage(status).title).toBe("Your 9-day streak ended");
  });

  it("marks the last seven days from runs and from the streak itself", () => {
    const status = streakStatus({ current: 3, best: 3, lastDate: day(0) }, [day(-5)], NOW);
    expect(status.week.map((entry) => entry.practiced)).toEqual([false, true, false, false, true, true, true]);
    expect(status.week[6]).toMatchObject({ today: true, label: "Sat" });
  });
});

describe("flame tiers and milestones", () => {
  it("grows the flame with the streak", () => {
    expect(tierFor(0)).toBeNull();
    expect(tierFor(1)?.id).toBe("spark");
    expect(tierFor(3)?.id).toBe("flame");
    expect(tierFor(30)?.id).toBe("blue");
    expect(tierFor(365)?.crown).toBe(true);
  });

  it("knows the milestones", () => {
    expect(isMilestone(7)).toBe(true);
    expect(isMilestone(8)).toBe(false);
  });
});

describe("streak freeze", () => {
  it("forgives one missed day a week", async () => {
    const { coverGap, weekOf } = await import("./streak");
    // Sat 26 Sep: last practice Thu 24, so Fri 25 was missed.
    expect(coverGap(day(-2), day(0), [])).toEqual([day(-1)]);
    // The week's freeze is already spent.
    expect(coverGap(day(-2), day(0), [day(-4)])).toBeNull();
    // Two missed days in the same week are one too many.
    expect(coverGap(day(-3), day(0), [])).toBeNull();
    expect(coverGap(day(-1), day(0), [])).toEqual([]);
    expect(weekOf("2026-09-26")).toBe("2026-09-21");
    expect(weekOf("2026-09-21")).toBe("2026-09-21");
  });

  it("keeps a frozen streak alive and says so", () => {
    const status = streakStatus({ current: 9, best: 9, lastDate: day(-2) }, [], NOW, []);
    expect(status).toMatchObject({ current: 9, mood: "frozen", frozenDays: [day(-1)], freezeReady: false });
    expect(status.week[5]).toMatchObject({ frozen: true, practiced: false });
    expect(streakMessage(status).title).toBe("A freeze saved your streak");
  });

  it("still breaks when the freeze is gone", () => {
    const status = streakStatus({ current: 9, best: 9, lastDate: day(-2) }, [], NOW, [day(-4)]);
    expect(status).toMatchObject({ current: 0, mood: "sleep", lost: 9 });
  });
});

describe("streak reminders", () => {
  it("fires once, in the evening, only when today is not done", async () => {
    const { reminderDue } = await import("./streak-reminder");
    const on = { enabled: true, hour: 20 };
    const evening = new Date(2026, 8, 26, 20, 30);
    expect(reminderDue(on, { current: 5, practicedToday: false }, evening, null)).toBe(true);
    expect(reminderDue(on, { current: 5, practicedToday: false }, evening, "2026-09-26")).toBe(false);
    expect(reminderDue(on, { current: 5, practicedToday: true }, evening, null)).toBe(false);
    expect(reminderDue(on, { current: 0, practicedToday: false }, evening, null)).toBe(false);
    expect(reminderDue(on, { current: 5, practicedToday: false }, new Date(2026, 8, 26, 19, 59), null)).toBe(false);
    expect(reminderDue({ ...on, enabled: false }, { current: 5, practicedToday: false }, evening, null)).toBe(false);
  });
});
