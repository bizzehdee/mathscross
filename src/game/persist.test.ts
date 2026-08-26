import { describe, expect, it } from 'vitest'
import { Difficulty } from '../engine/difficulty'
import { gridFromText } from '../engine/grid'
import { CellKind, EMPTY } from '../engine/types'
import { createGameState, enter, undo } from './state'
import {
  clearBoard,
  DAILY_KEY,
  FREE_PLAY_KEY,
  loadBoard,
  loadSettings,
  loadStats,
  saveBoard,
  saveSettings,
  saveStats,
  type StorageLike,
} from './persist'
import { emptyStats, recordCompletion } from '../features/stats/stats'

const PUZZLE = `
  1 + 2 = ?
  + # + # +
  2 + 1 = 3
  = # = # =
  3 + 3 = ?
`

/** An in-memory backend, so tests never touch a real storage. */
function memory(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...seed }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

function game() {
  return createGameState(gridFromText(PUZZLE), Difficulty.Easy)
}

describe('board round trip', () => {
  it('restores the puzzle, the entries and the clock', () => {
    const storage = memory()
    const state = game()
    enter(state, 4, 3)

    saveBoard('free', state, 42_000, storage)
    const loaded = loadBoard('free', storage)

    expect(loaded).not.toBeNull()
    expect(loaded?.difficulty).toBe(Difficulty.Easy)
    expect(loaded?.board.values[4]).toBe(3)
    // The puzzle keeps its blank, so the restored cell is still editable.
    expect(loaded?.puzzle.values[4]).toBe(EMPTY)
    expect(loaded?.elapsedMs).toBe(42_000)
  })

  it('restores the undo history, so undo survives a resume', () => {
    // Plan section 8.6: the moment a player most needs undo is right after
    // returning to a half-finished board.
    const storage = memory()
    const state = game()
    enter(state, 4, 3)
    enter(state, 24, 6)
    undo(state)

    saveBoard('free', state, 0, storage)
    const loaded = loadBoard('free', storage)

    expect(loaded?.history).toHaveLength(2)
    expect(loaded?.historyIndex).toBe(1)
  })

  it('never writes the solution', () => {
    // Plan section 7.1. The solution follows from the givens so it cannot be kept
    // secret, but writing it under a well-known key makes reading the answer a
    // two-click operation needing no knowledge at all.
    const storage = memory()
    const state = game()
    enter(state, 4, 3)
    enter(state, 24, 6)

    saveBoard('free', state, 0, storage)
    const written = storage.data[FREE_PLAY_KEY] ?? ''

    expect(written).not.toContain('solution')
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(Object.keys(parsed)).not.toContain('solution')
  })
})

describe('the two slots', () => {
  it('keeps free play and the daily apart', () => {
    // A daily is date-bound: letting a free-play game overwrite a half-finished one
    // would lose it permanently and break a streak. Plan section 7.1.
    const storage = memory()
    const free = game()
    enter(free, 4, 3)
    const daily = game()
    enter(daily, 4, 7)

    saveBoard('free', free, 0, storage)
    saveBoard('daily', daily, 0, storage, '20260826')

    expect(loadBoard('free', storage)?.board.values[4]).toBe(3)
    expect(loadBoard('daily', storage)?.board.values[4]).toBe(7)
    expect(loadBoard('daily', storage)?.dateKey).toBe('20260826')
  })

  it('uses separate keys, so a torn write cannot corrupt the other', () => {
    const storage = memory()
    saveBoard('free', game(), 0, storage)
    saveBoard('daily', game(), 0, storage, '20260826')

    expect(Object.keys(storage.data).sort()).toEqual([DAILY_KEY, FREE_PLAY_KEY].sort())
  })

  it('clears one slot without touching the other', () => {
    const storage = memory()
    saveBoard('free', game(), 0, storage)
    saveBoard('daily', game(), 0, storage, '20260826')

    clearBoard('free', storage)

    expect(loadBoard('free', storage)).toBeNull()
    expect(loadBoard('daily', storage)).not.toBeNull()
  })
})

describe('reads never throw', () => {
  it('returns null for an empty slot', () => {
    expect(loadBoard('free', memory())).toBeNull()
  })

  it('returns null for unparseable JSON', () => {
    // Truncated by a kill mid-write, or hand-edited. Ordinary here, not exceptional.
    expect(loadBoard('free', memory({ [FREE_PLAY_KEY]: '{"v":1,' }))).toBeNull()
  })

  it('returns null for a board whose arrays do not match its size', () => {
    const bad = JSON.stringify({
      v: 1,
      difficulty: 'easy',
      size: 5,
      kinds: [1, 2, 3],
      givens: [1],
      entries: [1],
      elapsedMs: 0,
      history: [],
      historyIndex: 0,
    })
    expect(loadBoard('free', memory({ [FREE_PLAY_KEY]: bad }))).toBeNull()
  })

  it('ignores a solution field left by an older version', () => {
    const state = game()
    const storage = memory()
    saveBoard('free', state, 0, storage)

    const withSolution = JSON.parse(storage.data[FREE_PLAY_KEY] ?? '{}') as Record<string, unknown>
    withSolution['solution'] = [1, 2, 3, 4, 5]
    storage.data[FREE_PLAY_KEY] = JSON.stringify(withSolution)

    const loaded = loadBoard('free', storage)
    expect(loaded).not.toBeNull()
    expect(loaded as unknown as Record<string, unknown>).not.toHaveProperty('solution')
  })

  it('discards a nonsense history rather than the whole board', () => {
    const state = game()
    const storage = memory()
    saveBoard('free', state, 0, storage)

    const payload = JSON.parse(storage.data[FREE_PLAY_KEY] ?? '{}') as Record<string, unknown>
    payload['history'] = ['not a move', { cell: 'x' }]
    storage.data[FREE_PLAY_KEY] = JSON.stringify(payload)

    const loaded = loadBoard('free', storage)
    expect(loaded).not.toBeNull()
    expect(loaded?.history).toEqual([])
  })

  it('survives a storage backend that throws', () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }

    expect(loadBoard('free', hostile)).toBeNull()
    expect(loadStats(hostile)).toEqual(emptyStats())
    expect(loadSettings(hostile).theme).toBe('system')
    // A write that cannot happen must not take the game down.
    expect(() => saveBoard('free', game(), 0, hostile)).not.toThrow()
  })
})

describe('the loaded board is playable', () => {
  it('keeps kinds, so a given stays a given and a blank stays editable', () => {
    const storage = memory()
    saveBoard('free', game(), 0, storage)
    const loaded = loadBoard('free', storage)

    expect(loaded?.puzzle.kinds[0]).toBe(CellKind.Digit)
    expect(loaded?.puzzle.kinds[6]).toBe(CellKind.Block)
    expect(loaded?.puzzle.values[0]).toBe(1)
    expect(loaded?.puzzle.values[4]).toBe(EMPTY)
  })
})

describe('stats and settings', () => {
  it('round trips stats', () => {
    const storage = memory()
    const stats = recordCompletion(emptyStats(), Difficulty.Easy, 30_000)
    saveStats(stats, storage)

    const loaded = loadStats(storage)
    expect(loaded.byDifficulty.easy.completed).toBe(1)
    expect(loaded.byDifficulty.easy.bestMs).toBe(30_000)
  })

  it('repairs stats written by something else', () => {
    const storage = memory({ 'mathscross.stats.v1': '{"v":1,"byDifficulty":{"easy":{"completed":"lots"}}}' })
    const loaded = loadStats(storage)

    expect(loaded.byDifficulty.easy.completed).toBe(0)
    expect(loaded.daily.currentStreak).toBe(0)
  })

  it('round trips settings and rejects an unknown theme', () => {
    const storage = memory()
    saveSettings({ v: 1, theme: 'contrast', onboardingDismissed: true }, storage)
    expect(loadSettings(storage).theme).toBe('contrast')
    expect(loadSettings(storage).onboardingDismissed).toBe(true)

    const bad = memory({ 'mathscross.settings.v1': '{"v":1,"theme":"neon"}' })
    expect(loadSettings(bad).theme).toBe('system')
  })
})
