export interface DuelRecord {
  id: string;
  timestamp: number;
  opponentName: string;
  myWpm: number;
  oppWpm: number;
  myAccuracy: number;
  oppAccuracy: number;
  language: string;
  outcome: 'victory' | 'defeat' | 'draw';
  /** Finishing place and room size; absent on 1v1 records from before multi-player rooms. */
  placement?: number;
  playerCount?: number;
}

const DUEL_HISTORY_KEY = 'codey_duel_history_v1';

export function getDuelHistory(): DuelRecord[] {
  try {
    const raw = localStorage.getItem(DUEL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as DuelRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveDuelRecord(record: DuelRecord): DuelRecord[] {
  const history = getDuelHistory();
  const updated = [record, ...history].slice(0, 50); // Keep last 50 matches
  try {
    localStorage.setItem(DUEL_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // quota
  }
  return updated;
}

export function getDuelStats() {
  const history = getDuelHistory();
  const total = history.length;
  const wins = history.filter((r) => r.outcome === 'victory').length;
  const losses = history.filter((r) => r.outcome === 'defeat').length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const bestWpm = total > 0 ? Math.max(...history.map((r) => r.myWpm)) : 0;

  // Calculate current win streak
  let currentStreak = 0;
  for (const r of history) {
    if (r.outcome === 'victory') currentStreak++;
    else break;
  }

  return {
    total,
    wins,
    losses,
    winRate,
    bestWpm,
    currentStreak,
  };
}
