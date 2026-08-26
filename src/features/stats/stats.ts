/**
 * Statistics. Plan section 7.3.
 *
 * Completions only. Nothing tracks attempts or abandonment, which avoids ever
 * having to define "abandoned" and keeps the stored shape small.
 *
 * Times are summarised by **median**, not mean, so one pathological session — a
 * puzzle left open over lunch with the timer paused and resumed — does not distort
 * the figure a player sees.
 */
import { ALL_DIFFICULTIES, type Difficulty } from '../../engine/difficulty'

export const STATS_STORAGE_KEY = 'mathscross.stats.v1'

export interface DifficultyStats {
  readonly completed: number
  /** Milliseconds. Null until something has been completed. */
  readonly bestMs: number | null
  /**
   * Every completion time, for the median.
   *
   * Capped, because this is the only part of stored state that grows without
   * bound. Section 7.2 puts the whole payload well inside `localStorage`, and a cap
   * is what keeps it there after a thousand puzzles.
   */
  readonly times: readonly number[]
}

export interface DailyStats {
  readonly currentStreak: number
  readonly longestStreak: number
  readonly completed: number
  /** The last date completed, as `YYYYMMDD` in UTC. Null if never. */
  readonly lastDateKey: string | null
}

export interface Stats {
  readonly v: 1
  readonly byDifficulty: Readonly<Record<Difficulty, DifficultyStats>>
  readonly daily: DailyStats
}

/** How many completion times are kept per difficulty. */
export const MAX_TIMES = 100

export function emptyStats(): Stats {
  const byDifficulty = {} as Record<Difficulty, DifficultyStats>
  for (const difficulty of ALL_DIFFICULTIES) {
    byDifficulty[difficulty] = { completed: 0, bestMs: null, times: [] }
  }
  return {
    v: 1,
    byDifficulty,
    daily: { currentStreak: 0, longestStreak: 0, completed: 0, lastDateKey: null },
  }
}

/** Records a free-play completion. */
export function recordCompletion(
  stats: Stats,
  difficulty: Difficulty,
  elapsedMs: number,
): Stats {
  const held = stats.byDifficulty[difficulty]
  const times = [...held.times, elapsedMs].slice(-MAX_TIMES)

  return {
    ...stats,
    byDifficulty: {
      ...stats.byDifficulty,
      [difficulty]: {
        completed: held.completed + 1,
        bestMs: held.bestMs === null ? elapsedMs : Math.min(held.bestMs, elapsedMs),
        times,
      },
    },
  }
}

/**
 * Records a daily completion, and updates the streak.
 *
 * Plan section 7.4: the streak increments only when today's daily is completed on
 * today's UTC date, a missed day resets it to zero, and there is no catch-up.
 * Completing the same date twice changes nothing, so a double-tap cannot inflate a
 * streak.
 */
export function recordDaily(stats: Stats, dateKey: string, previousDateKey: string): Stats {
  if (stats.daily.lastDateKey === dateKey) {
    return stats
  }

  const continues = stats.daily.lastDateKey === previousDateKey
  const currentStreak = continues ? stats.daily.currentStreak + 1 : 1

  return {
    ...stats,
    daily: {
      currentStreak,
      longestStreak: Math.max(stats.daily.longestStreak, currentStreak),
      completed: stats.daily.completed + 1,
      lastDateKey: dateKey,
    },
  }
}

/**
 * Zeroes a streak that has lapsed.
 *
 * Called when the daily screen opens. A streak is a set of dates, so whether it
 * still stands is a question about today rather than something to record when a day
 * is missed — nothing runs on the day a player does not open the app.
 */
export function expireStreak(stats: Stats, todayKey: string, yesterdayKey: string): Stats {
  const { lastDateKey, currentStreak } = stats.daily
  if (currentStreak === 0) {
    return stats
  }
  if (lastDateKey === todayKey || lastDateKey === yesterdayKey) {
    return stats
  }
  return { ...stats, daily: { ...stats.daily, currentStreak: 0 } }
}

export function medianMs(times: readonly number[]): number | null {
  if (times.length === 0) {
    return null
  }
  const sorted = [...times].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? null
}

/**
 * Repairs anything read back from storage.
 *
 * Every field is checked, because storage can hold a value written by an older
 * version, hand-edited, or truncated by a kill mid-write. A read must always yield
 * usable stats rather than throwing. Plan section 7.2.
 */
export function normaliseStats(raw: unknown): Stats {
  const empty = emptyStats()
  if (typeof raw !== 'object' || raw === null) {
    return empty
  }
  const candidate = raw as Partial<Stats>

  const byDifficulty = {} as Record<Difficulty, DifficultyStats>
  for (const difficulty of ALL_DIFFICULTIES) {
    const held = candidate.byDifficulty?.[difficulty]
    const times = Array.isArray(held?.times)
      ? held.times.filter((time): time is number => Number.isFinite(time) && time >= 0)
      : []
    byDifficulty[difficulty] = {
      completed: countOf(held?.completed),
      bestMs:
        typeof held?.bestMs === 'number' && Number.isFinite(held.bestMs) && held.bestMs >= 0
          ? held.bestMs
          : null,
      times: times.slice(-MAX_TIMES),
    }
  }

  const daily = candidate.daily
  return {
    v: 1,
    byDifficulty,
    daily: {
      currentStreak: countOf(daily?.currentStreak),
      longestStreak: countOf(daily?.longestStreak),
      completed: countOf(daily?.completed),
      lastDateKey:
        typeof daily?.lastDateKey === 'string' && /^\d{8}$/.test(daily.lastDateKey)
          ? daily.lastDateKey
          : null,
    },
  }
}

function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}
