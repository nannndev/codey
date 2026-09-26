import type { RunResult, TestMode, PersonalBest, Settings } from '../types';

// Legacy keys are preserved so the Codey rename does not erase user data.
const HISTORY_KEY = 'codetype_history';
const STREAK_KEY = 'codetype_streak';
const SETTINGS_KEY = 'codetype_settings';

export interface StreakData {
  current: number;
  best: number;
  lastDate: string;
}

export interface DailyGoalProgress {
  runs: number;
  minutes: number;
  chars: number;
  goals: Settings['goals'];
}

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  goals: { runsPerDay: 10, minutesPerDay: 15, charsPerDay: 2000 },
  achievements: [],
};

export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// History

export function getHistory(): RunResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Stores a finished run and returns it with its id, so uploads use the same identity as the history. */
export function saveResult(result: RunResult): RunResult {
  const history = getHistory();
  const saved = { ...result, id: result.id ?? `${result.timestamp}-${Math.random().toString(36).slice(2, 8)}` };
  history.push(saved);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-500)));
  return saved;
}

/** Adds runs from other devices, oldest first, keeping the newest 500. */
export function mergeIntoHistory(runs: RunResult[]): void {
  if (runs.length === 0) return;
  const merged = [...getHistory(), ...runs].sort((a, b) => a.timestamp - b.timestamp).slice(-500);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
}

/** Links a local run to its cloud copy (e.g. the verified Ranked document). */
export function setRunCloudId(runId: string, cloudId: string): void {
  const history = getHistory();
  const index = history.findIndex((run) => run.id === runId);
  if (index < 0 || history[index].cloudId === cloudId) return;
  history[index] = { ...history[index], cloudId };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function ensureHistoryIds(): RunResult[] {
  const history = getHistory();
  let changed = false;
  const normalized = history.map((result, index) => {
    if (result.id) return result;
    changed = true;
    return { ...result, id: `${result.timestamp}-${index.toString(36)}` };
  });
  if (changed) localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getResults(): RunResult[] {
  return getHistory();
}

export function getResultsByMode(mode: TestMode): RunResult[] {
  return getHistory().filter((r) => r.mode === mode);
}

// Streak

export function getStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  return { current: 0, best: 0, lastDate: '' };
}

export function updateStreak(): void {
  const streak = getStreak();
  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayDate = new Date();
  const today = toLocalDateKey(todayDate);

  if (streak.lastDate === today) return;

  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const yesterday = toLocalDateKey(yesterdayDate);
  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else {
    streak.current = 1;
  }

  streak.lastDate = today;
  streak.best = Math.max(streak.best, streak.current);
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

// Versioned Settings

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1) {
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        goals: { ...DEFAULT_SETTINGS.goals, ...parsed.goals },
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      };
    }
  } catch {
    // fall through
  }
  const migrated = { ...DEFAULT_SETTINGS };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
  return migrated;
}

export function getDailyGoalProgress(date: Date = new Date()): DailyGoalProgress {
  const dateKey = toLocalDateKey(date);
  const runs = getHistory().filter((run) => toLocalDateKey(new Date(run.timestamp)) === dateKey);

  return {
    runs: runs.length,
    minutes: runs.reduce((total, run) => total + Math.max(0, run.duration) / 60000, 0),
    chars: runs.reduce((total, run) => total + Math.max(0, run.charsTyped), 0),
    goals: getSettings().goals,
  };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable
  }
}

// Personal Bests

/**
 * Groups runs that are comparable: same language and mode, and the same length
 * (snippet) or clock (timed). Snippet and zen runs vary in elapsed time, so their
 * duration is not part of the key; timed runs are keyed by whole seconds.
 */
function personalBestKey(language: string, mode: TestMode, duration: number | null | undefined, snippetLength?: RunResult['snippetLength']): string {
  const lengthKey = mode === 'snippet' ? snippetLength ?? 'legacy' : '-';
  const clock = mode === 'timed' && duration ? Math.round(duration / 1000) : 0;
  return `${language}|${mode}|${clock}|${lengthKey}`;
}

export function getPersonalBests(): PersonalBest[] {
  const history = getHistory();
  const map = new Map<string, PersonalBest>();

  for (const run of history) {
    const key = personalBestKey(run.language, run.mode, run.duration, run.snippetLength);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        language: run.language,
        mode: run.mode,
        duration: run.mode === 'timed' ? run.duration ?? null : null,
        snippetLength: run.snippetLength,
        bestWpm: run.wpm,
        bestAccuracy: run.accuracy,
        bestConsistency: run.consistency,
        lastRunAt: run.timestamp,
        totalRuns: 1,
      });
    } else {
      existing.bestWpm = Math.max(existing.bestWpm, run.wpm);
      existing.bestAccuracy = Math.max(existing.bestAccuracy, run.accuracy);
      existing.bestConsistency = Math.max(existing.bestConsistency, run.consistency);
      existing.lastRunAt = Math.max(existing.lastRunAt, run.timestamp);
      existing.totalRuns += 1;
    }
  }

  return Array.from(map.values());
}

export function getPersonalBest(
  language: string,
  mode: TestMode,
  duration: number | null,
  snippetLength?: RunResult['snippetLength'],
): PersonalBest | null {
  const key = personalBestKey(language, mode, duration, snippetLength);
  return getPersonalBests().find((pb) => personalBestKey(pb.language, pb.mode, pb.duration, pb.snippetLength) === key) ?? null;
}

export function getBestRunForGhost(
  snippetId?: string,
  language?: string,
  mode: TestMode = 'snippet',
  duration: number | null = null,
  snippetLength?: RunResult['snippetLength'],
): RunResult | null {
  const history = getHistory();
  if (history.length === 0) return null;

  // First priority: match exact snippetId in history with highest WPM
  if (snippetId) {
    const matchingSnippetRuns = history.filter(
      (r) => r.snippetId === snippetId && r.mode === mode,
    );
    if (matchingSnippetRuns.length > 0) {
      return matchingSnippetRuns.reduce((best, cur) => (cur.wpm > best.wpm ? cur : best));
    }
  }

  // Second priority: match language, mode, duration, snippetLength with highest WPM
  const matchingCategoryRuns = history.filter((r) => {
    if (r.mode !== mode) return false;
    if (language && language !== 'All' && r.language !== language) return false;
    if (mode === 'timed' && r.duration !== duration) return false;
    if (mode === 'snippet' && snippetLength && r.snippetLength !== snippetLength) return false;
    return true;
  });

  if (matchingCategoryRuns.length > 0) {
    return matchingCategoryRuns.reduce((best, cur) => (cur.wpm > best.wpm ? cur : best));
  }

  return null;
}
