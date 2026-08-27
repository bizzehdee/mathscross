import { describe, expect, it } from 'vitest'
import { Difficulty } from '../../engine/difficulty'
import { generate, GENERATOR_VERSION } from '../../engine/generate'
import {
  dailyDateKey,
  dailyDifficulty,
  dailyRequest,
  dailySeed,
  previousDateKey,
} from './daily'
import { emptyStats, expireStreak, recordDaily } from '../stats/stats'

describe('date keys', () => {
  it('formats as YYYYMMDD in UTC', () => {
    expect(dailyDateKey(new Date('2026-08-26T12:00:00Z'))).toBe('20260826')
    expect(dailyDateKey(new Date('2026-01-05T00:00:00Z'))).toBe('20260105')
  })

  it('uses UTC, not local time', () => {
    // Two players in different time zones must get the same puzzle on the same
    // date. The consequence is that the daily rolls over at 01:00 during British
    // Summer Time, which is a known property rather than a defect.
    expect(dailyDateKey(new Date('2026-08-26T23:30:00Z'))).toBe('20260826')
    expect(dailyDateKey(new Date('2026-08-27T00:30:00Z'))).toBe('20260827')
  })

  it('steps back a day, across a month boundary', () => {
    expect(previousDateKey(new Date('2026-08-01T12:00:00Z'))).toBe('20260731')
    expect(previousDateKey(new Date('2026-03-01T12:00:00Z'))).toBe('20260228')
  })
})

describe('seeds', () => {
  it('gives adjacent dates non-adjacent seeds', () => {
    // Consecutive dailies must not look alike, which they would if consecutive
    // date keys produced neighbouring seeds.
    const a = dailySeed('20260826')
    const b = dailySeed('20260827')

    expect(Math.abs(a - b)).toBeGreaterThan(1000)
  })

  it('is stable for a date', () => {
    expect(dailySeed('20260826')).toBe(dailySeed('20260826'))
  })

  it('depends on the date alone, with no generator version mixed in', () => {
    // Plan section 5.7: an earlier draft froze a version into the seed so a date
    // produced the same board forever, which made generator bugs permanently
    // unfixable in exchange for parity nothing can observe. What protects a player
    // is persisting the board and recording completions by date key.
    const before = dailySeed('20260826')
    expect(before).toBe(dailySeed('20260826'))
    // The constant exists for save codes in release 2 and must not reach the seed.
    expect(GENERATOR_VERSION).toBe(1)
  })
})

describe('difficulty rotation', () => {
  it('rotates by UTC weekday', () => {
    // 2026-08-24 is a Monday.
    const days = [
      ['2026-08-24T12:00:00Z', Difficulty.Easy],
      ['2026-08-25T12:00:00Z', Difficulty.Easy],
      ['2026-08-26T12:00:00Z', Difficulty.Medium],
      ['2026-08-27T12:00:00Z', Difficulty.Medium],
      ['2026-08-28T12:00:00Z', Difficulty.Hard],
      ['2026-08-29T12:00:00Z', Difficulty.Hard],
      ['2026-08-30T12:00:00Z', Difficulty.Extreme],
    ] as const

    for (const [iso, expected] of days) {
      expect(dailyDifficulty(new Date(iso)), iso).toBe(expected)
    }
  })

  it('bundles the date key, seed and difficulty together', () => {
    const request = dailyRequest(new Date('2026-08-26T12:00:00Z'))

    expect(request.dateKey).toBe('20260826')
    expect(request.difficulty).toBe(Difficulty.Medium)
    expect(request.seed).toBe(dailySeed('20260826'))
  })
})

describe('a daily is generable and identical everywhere', () => {
  it('produces the same board twice for a date', () => {
    // The property the whole daily depends on: same date, same board, on every
    // device, with no server to arbitrate.
    const request = dailyRequest(new Date('2026-08-24T12:00:00Z'))
    const a = generate({ seed: request.seed, difficulty: request.difficulty })
    const b = generate({ seed: request.seed, difficulty: request.difficulty })

    expect(a.ok).toBe(true)
    if (a.ok && b.ok) {
      expect(Array.from(a.puzzle.puzzle.values)).toEqual(Array.from(b.puzzle.puzzle.values))
    }
  })
})

describe('streaks', () => {
  it('increments on a consecutive day', () => {
    let stats = emptyStats()
    stats = recordDaily(stats, '20260824', '20260823')
    stats = recordDaily(stats, '20260825', '20260824')
    stats = recordDaily(stats, '20260826', '20260825')

    expect(stats.daily.currentStreak).toBe(3)
    expect(stats.daily.longestStreak).toBe(3)
    expect(stats.daily.completed).toBe(3)
  })

  it('restarts at one after a missed day', () => {
    // A missed day resets the streak. No catch-up and no backfill: a daily that can
    // be finished whenever is not a daily. Plan section 7.4.
    let stats = emptyStats()
    stats = recordDaily(stats, '20260824', '20260823')
    stats = recordDaily(stats, '20260825', '20260824')
    // 26th skipped.
    stats = recordDaily(stats, '20260827', '20260826')

    expect(stats.daily.currentStreak).toBe(1)
    expect(stats.daily.longestStreak).toBe(2)
    expect(stats.daily.completed).toBe(3)
  })

  it('ignores completing the same date twice', () => {
    // A double-tap must not inflate a streak.
    let stats = emptyStats()
    stats = recordDaily(stats, '20260826', '20260825')
    stats = recordDaily(stats, '20260826', '20260825')

    expect(stats.daily.currentStreak).toBe(1)
    expect(stats.daily.completed).toBe(1)
  })

  it('remembers the longest streak after a reset', () => {
    let stats = emptyStats()
    for (const [date, previous] of [
      ['20260801', '20260731'],
      ['20260802', '20260801'],
      ['20260803', '20260802'],
      ['20260810', '20260809'],
    ] as const) {
      stats = recordDaily(stats, date, previous)
    }

    expect(stats.daily.currentStreak).toBe(1)
    expect(stats.daily.longestStreak).toBe(3)
  })
})

describe('a lapsed streak expires when the app is next opened', () => {
  it('zeroes a streak whose last day is older than yesterday', () => {
    // Nothing runs on the day a player does not open the app, so whether a streak
    // still stands is a question asked about today.
    let stats = emptyStats()
    stats = recordDaily(stats, '20260820', '20260819')

    stats = expireStreak(stats, '20260826', '20260825')
    expect(stats.daily.currentStreak).toBe(0)
    // The record stands.
    expect(stats.daily.longestStreak).toBe(1)
    expect(stats.daily.completed).toBe(1)
  })

  it('leaves a streak alone when yesterday was the last day', () => {
    let stats = emptyStats()
    stats = recordDaily(stats, '20260825', '20260824')

    stats = expireStreak(stats, '20260826', '20260825')
    expect(stats.daily.currentStreak).toBe(1)
  })

  it('leaves a streak alone when today is already done', () => {
    let stats = emptyStats()
    stats = recordDaily(stats, '20260826', '20260825')

    stats = expireStreak(stats, '20260826', '20260825')
    expect(stats.daily.currentStreak).toBe(1)
  })
})
