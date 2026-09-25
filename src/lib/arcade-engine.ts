/**
 * Rhythm engine for Arcade mode. Pure logic on one game clock (ms, pauses
 * excluded) so the renderer and hit judgment always agree on where a note is.
 */

export type Judgment = "perfect" | "great" | "good" | "miss";
export type EngineState = "ready" | "running" | "paused" | "finished";

export interface ArcadeNote {
  id: number;
  lane: number;
  /** Clock time the note reaches the strike line. */
  time: number;
  /** Time from spawn to the strike line, fixed at spawn so speed-ups don't warp it. */
  travel: number;
  judgment: Judgment | null;
  /** Clock time it was judged, for exit animations. */
  judgedAt: number | null;
}

export type ArcadeEvent =
  | { type: "hit"; lane: number; judgment: Exclude<Judgment, "miss">; points: number; note: ArcadeNote }
  | { type: "miss"; lane: number; note: ArcadeNote }
  | { type: "ghost"; lane: number }
  | { type: "levelup"; level: number }
  | { type: "life"; lives: number }
  | { type: "overdrive"; active: boolean }
  | { type: "finished" };

export interface ArcadeStats {
  score: number;
  combo: number;
  bestCombo: number;
  multiplier: number;
  lives: number;
  level: number;
  /** 0-100; full meter can trigger Overdrive. */
  overdriveMeter: number;
  overdriveActive: boolean;
  counts: Record<Judgment, number>;
  remainingMs: number;
}

export const WINDOWS = { perfect: 50, great: 100, good: 150 } as const;
const POINTS = { perfect: 300, great: 200, good: 100 } as const;
const METER_GAIN = { perfect: 8, great: 4, good: 0 } as const;

export const ROUND_MS = 60_000;
const LEVEL_MS = 12_000;
const MAX_LIVES = 5;
const OVERDRIVE_MS = 8_000;
/** Consecutive hits that restore a life. */
const LIFE_STREAK = 30;
const LEAD_IN_MS = 1_200;

const PATTERNS = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 2, 1, 3, 4, 6, 5, 7],
  [0, 7, 1, 6, 2, 5, 3, 4],
  [0, 1, 0, 2, 3, 2, 4, 5, 4, 6, 7, 6],
  [3, 4, 2, 5, 1, 6, 0, 7],
  [0, 3, 1, 2, 4, 7, 5, 6],
] as const;

/** Small seeded PRNG so a seed replays the same chart (used by tests). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelBeatMs(level: number) {
  return Math.max(250, 620 - (level - 1) * 90);
}

export function levelTravelMs(level: number) {
  return Math.max(1300, 2300 - (level - 1) * 240);
}

export function grade(counts: Record<Judgment, number>): { letter: string; accuracy: number } {
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total === 0) return { letter: "–", accuracy: 0 };
  const accuracy = ((counts.perfect + counts.great * 0.8 + counts.good * 0.5) / total) * 100;
  const letter = accuracy >= 95 ? "S" : accuracy >= 85 ? "A" : accuracy >= 70 ? "B" : accuracy >= 50 ? "C" : "D";
  return { letter, accuracy };
}

export class ArcadeEngine {
  state: EngineState = "ready";
  notes: ArcadeNote[] = [];
  readonly laneCount: number;

  private clock = 0;
  private lastRealTime: number | null = null;
  private nextSpawnAt = LEAD_IN_MS;
  private patternIndex = 0;
  private patternStep = 0;
  private nextId = 1;
  private overdriveUntil = 0;
  private random: () => number;
  private stats: Omit<ArcadeStats, "multiplier" | "overdriveActive" | "remainingMs">;

  constructor(laneCount = 8, seed = Math.floor(Math.random() * 2 ** 31)) {
    this.laneCount = laneCount;
    this.random = mulberry32(seed);
    this.patternIndex = Math.floor(this.random() * PATTERNS.length);
    this.stats = this.freshStats();
  }

  private freshStats() {
    return {
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: MAX_LIVES,
      level: 1,
      overdriveMeter: 0,
      counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    };
  }

  /** Game clock in ms since start, excluding pauses. */
  get time() {
    return this.clock;
  }

  snapshot(): ArcadeStats {
    const overdriveActive = this.clock < this.overdriveUntil;
    return {
      ...this.stats,
      counts: { ...this.stats.counts },
      multiplier: this.multiplier(),
      overdriveActive,
      remainingMs: Math.max(0, ROUND_MS - this.clock),
    };
  }

  multiplier() {
    return Math.min(4, 1 + Math.floor(this.stats.combo / 10));
  }

  start(realTime: number) {
    this.state = "running";
    this.lastRealTime = realTime;
  }

  pause() {
    if (this.state === "running") {
      this.state = "paused";
      this.lastRealTime = null;
    }
  }

  resume(realTime: number) {
    if (this.state === "paused") {
      this.state = "running";
      this.lastRealTime = realTime;
    }
  }

  /** Advance the clock to `realTime`, spawning and expiring notes. */
  update(realTime: number): ArcadeEvent[] {
    const events: ArcadeEvent[] = [];
    if (this.state !== "running") return events;
    // Clamp long stalls so they don't dump a burst of misses. The page also
    // pauses on tab switch; this only covers hitches on slow machines.
    const delta = this.lastRealTime === null ? 0 : Math.min(250, Math.max(0, realTime - this.lastRealTime));
    this.lastRealTime = realTime;
    this.advance(delta, events);
    return events;
  }

  /** Test hook: advance the clock by `ms` directly. */
  step(ms: number): ArcadeEvent[] {
    const events: ArcadeEvent[] = [];
    if (this.state !== "running") return events;
    this.advance(ms, events);
    return events;
  }

  private advance(delta: number, events: ArcadeEvent[]) {
    const wasOverdrive = this.clock < this.overdriveUntil;
    this.clock += delta;
    if (wasOverdrive && this.clock >= this.overdriveUntil) events.push({ type: "overdrive", active: false });

    const level = Math.min(5, 1 + Math.floor(this.clock / LEVEL_MS));
    if (level !== this.stats.level) {
      this.stats.level = level;
      events.push({ type: "levelup", level });
    }

    // Spawn so each note arrives at the strike line `travel` ms after spawning.
    // Stop spawning notes that would land after the round ends.
    while (this.nextSpawnAt <= this.clock && this.nextSpawnAt < ROUND_MS - 400) {
      this.spawnAt(this.nextSpawnAt);
      this.nextSpawnAt += levelBeatMs(this.stats.level);
    }

    for (const note of this.notes) {
      if (note.judgment === null && this.clock - note.time > WINDOWS.good) {
        this.judgeMiss(note, events);
        if (this.state === "finished") return;
      }
    }

    // Drop notes whose exit animation is over.
    this.notes = this.notes.filter((note) => note.judgedAt === null || this.clock - note.judgedAt < 1200);

    if (this.clock >= ROUND_MS && this.notes.every((note) => note.judgment !== null)) {
      this.finish(events);
    }
  }

  private spawnAt(spawnTime: number) {
    const travel = levelTravelMs(this.stats.level);
    const pattern = PATTERNS[this.patternIndex];
    const lane = pattern[this.patternStep % pattern.length] % this.laneCount;
    this.patternStep += 1;
    if (this.patternStep % pattern.length === 0) {
      this.patternIndex = Math.floor(this.random() * PATTERNS.length);
    }
    const time = spawnTime + travel;
    this.notes.push({ id: this.nextId++, lane, time, travel, judgment: null, judgedAt: null });

    // Chords from level 3: a second note on the mirrored lane.
    if (this.stats.level >= 3 && this.random() < 0.18) {
      const mirror = this.laneCount - 1 - lane;
      if (mirror !== lane) this.notes.push({ id: this.nextId++, lane: mirror, time, travel, judgment: null, judgedAt: null });
    }
  }

  /** Player pressed a lane key at the current clock. */
  press(lane: number): ArcadeEvent | null {
    if (this.state !== "running") return null;
    let best: ArcadeNote | null = null;
    for (const note of this.notes) {
      if (note.lane !== lane || note.judgment !== null) continue;
      const offset = Math.abs(this.clock - note.time);
      if (offset <= WINDOWS.good && (!best || offset < Math.abs(this.clock - best.time))) best = note;
    }

    if (!best) {
      // Ghost tap: breaks the combo but costs no life.
      this.stats.combo = 0;
      return { type: "ghost", lane };
    }

    const offset = Math.abs(this.clock - best.time);
    const judgment = offset <= WINDOWS.perfect ? "perfect" : offset <= WINDOWS.great ? "great" : "good";
    best.judgment = judgment;
    best.judgedAt = this.clock;
    this.stats.counts[judgment] += 1;
    this.stats.combo += 1;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);

    const overdrive = this.clock < this.overdriveUntil;
    const points = POINTS[judgment] * this.multiplier() * (overdrive ? 2 : 1);
    this.stats.score += points;
    if (!overdrive) this.stats.overdriveMeter = Math.min(100, this.stats.overdriveMeter + METER_GAIN[judgment]);

    if (this.stats.combo % LIFE_STREAK === 0 && this.stats.lives < MAX_LIVES) {
      this.stats.lives += 1;
    }
    return { type: "hit", lane, judgment, points, note: best };
  }

  /** Spend a full meter for double points. Returns whether it activated. */
  activateOverdrive(): boolean {
    if (this.state !== "running" || this.stats.overdriveMeter < 100 || this.clock < this.overdriveUntil) return false;
    this.stats.overdriveMeter = 0;
    this.overdriveUntil = this.clock + OVERDRIVE_MS;
    return true;
  }

  overdriveProgress() {
    if (this.clock >= this.overdriveUntil) return 0;
    return (this.overdriveUntil - this.clock) / OVERDRIVE_MS;
  }

  private judgeMiss(note: ArcadeNote, events: ArcadeEvent[]) {
    note.judgment = "miss";
    note.judgedAt = this.clock;
    this.stats.counts.miss += 1;
    this.stats.combo = 0;
    this.stats.lives = Math.max(0, this.stats.lives - 1);
    events.push({ type: "miss", lane: note.lane, note });
    events.push({ type: "life", lives: this.stats.lives });
    if (this.stats.lives === 0) this.finish(events);
  }

  private finish(events: ArcadeEvent[]) {
    if (this.state === "finished") return;
    this.state = "finished";
    events.push({ type: "finished" });
  }
}
