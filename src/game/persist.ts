/**
 * Persistence. Plan sections 7.1 and 7.2.
 *
 * The only module that touches a storage API. Everything else goes through here,
 * so moving off `localStorage` — which section 7.2 lists three triggers for — is a
 * change to one file.
 *
 * Three rules, each of which has a reason recorded in the plan:
 *
 *   1. **Two board slots, not one.** Free play and the daily are separate keys. A
 *      daily is date-bound, so letting a free-play game overwrite a half-finished
 *      one would lose it permanently and break a streak through no fault of the
 *      player. The sibling project keeps a single slot; this is a deliberate
 *      divergence.
 *   2. **The solution is never written.** It follows from the givens, so it cannot
 *      be kept secret from a determined reader — but writing it under a well-known
 *      key makes reading the answer a two-click operation requiring no knowledge at
 *      all. A `solution` field found in an older save is ignored rather than
 *      trusted.
 *   3. **Every read returns a value.** Storage can be missing, cleared by the OS,
 *      written by an older version, or truncated by a kill mid-write. A `JSON.parse`
 *      failure is a normal case here, not an exception.
 */
import type { Difficulty } from '../engine/difficulty'
import { createGrid } from '../engine/grid'
import { EMPTY, type Grid } from '../engine/types'
import { emptyStats, normaliseStats, STATS_STORAGE_KEY, type Stats } from '../features/stats/stats'
import { MAX_HISTORY, type GameState, type Move } from './state'

export const FREE_PLAY_KEY = 'mathscross.game.v1'
export const DAILY_KEY = 'mathscross.daily.v1'
export const SETTINGS_KEY = 'mathscross.settings.v1'

/** The minimum a storage backend must provide. `localStorage` satisfies it. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** A no-op backend, for a private window or a context that throws on access. */
const NULL_STORAGE: StorageLike = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

/**
 * The backend, or a no-op when unavailable.
 *
 * Touching `localStorage` can throw outright — a browser set to block site data
 * raises on the property access, not on the call — so this is wrapped rather than
 * assumed.
 */
export function defaultStorage(): StorageLike {
  try {
    const probe = globalThis.localStorage
    if (probe === undefined || probe === null) {
      return NULL_STORAGE
    }
    return probe
  } catch {
    return NULL_STORAGE
  }
}

export type Slot = 'free' | 'daily'

function keyFor(slot: Slot): string {
  return slot === 'free' ? FREE_PLAY_KEY : DAILY_KEY
}

/**
 * One board slot, as stored.
 *
 * The mesh, the givens, the player's entries, the clock and the undo history — and
 * no solution. `dateKey` is set for the daily only, so a stale daily can be
 * recognised and discarded.
 */
export interface StoredBoard {
  readonly v: 1
  readonly difficulty: Difficulty
  readonly size: number
  /** Cell kinds, as a plain array for JSON. */
  readonly kinds: readonly number[]
  /** The puzzle's own values: givens, with `EMPTY` at every blank. */
  readonly givens: readonly number[]
  /** The board as the player left it. */
  readonly entries: readonly number[]
  readonly elapsedMs: number
  readonly history: readonly Move[]
  readonly historyIndex: number
  readonly dateKey?: string
}

export interface Settings {
  readonly v: 1
  readonly theme: 'system' | 'light' | 'dark' | 'contrast'
  readonly onboardingDismissed: boolean
}

export function defaultSettings(): Settings {
  return { v: 1, theme: 'system', onboardingDismissed: false }
}

export function saveBoard(
  slot: Slot,
  state: GameState,
  elapsedMs: number,
  storage: StorageLike = defaultStorage(),
  dateKey?: string,
): void {
  const payload: StoredBoard = {
    v: 1,
    difficulty: state.difficulty,
    size: state.puzzle.size,
    kinds: Array.from(state.puzzle.kinds),
    givens: Array.from(state.puzzle.values),
    entries: Array.from(state.board.values),
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    history: state.history.slice(-MAX_HISTORY),
    historyIndex: state.historyIndex,
    ...(dateKey === undefined ? {} : { dateKey }),
  }
  write(storage, keyFor(slot), payload)
}

export interface LoadedBoard {
  readonly difficulty: Difficulty
  readonly puzzle: Grid
  readonly board: Grid
  readonly elapsedMs: number
  readonly history: Move[]
  readonly historyIndex: number
  readonly dateKey: string | null
}

/**
 * Reads a board slot, or null when there is nothing usable there.
 *
 * Null covers absent, unparseable and inconsistent alike. A caller cannot act
 * differently on those, and pretending otherwise would push the checking outward.
 */
export function loadBoard(slot: Slot, storage: StorageLike = defaultStorage()): LoadedBoard | null {
  const raw = read(storage, keyFor(slot))
  if (raw === null || typeof raw !== 'object') {
    return null
  }
  const stored = raw as Partial<StoredBoard>

  const size = stored.size
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 3 || size > 15) {
    return null
  }
  const cells = size * size
  if (
    !isNumberArray(stored.kinds, cells) ||
    !isNumberArray(stored.givens, cells) ||
    !isNumberArray(stored.entries, cells) ||
    typeof stored.difficulty !== 'string'
  ) {
    return null
  }

  const puzzle = createGrid(size)
  puzzle.kinds.set(stored.kinds)
  puzzle.values.set(stored.givens)

  const board = createGrid(size)
  board.kinds.set(stored.kinds)
  board.values.set(stored.entries)

  const history = Array.isArray(stored.history)
    ? stored.history.filter(isMove).slice(-MAX_HISTORY)
    : []
  const historyIndex =
    typeof stored.historyIndex === 'number' &&
    Number.isInteger(stored.historyIndex) &&
    stored.historyIndex >= 0 &&
    stored.historyIndex <= history.length
      ? stored.historyIndex
      : history.length

  return {
    difficulty: stored.difficulty as Difficulty,
    puzzle,
    board,
    elapsedMs:
      typeof stored.elapsedMs === 'number' && Number.isFinite(stored.elapsedMs)
        ? Math.max(0, stored.elapsedMs)
        : 0,
    history,
    historyIndex,
    dateKey: typeof stored.dateKey === 'string' ? stored.dateKey : null,
  }
}

export function clearBoard(slot: Slot, storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(keyFor(slot))
  } catch {
    // Nothing to do. A slot that cannot be cleared is not worth failing over.
  }
}

export function loadStats(storage: StorageLike = defaultStorage()): Stats {
  const raw = read(storage, STATS_STORAGE_KEY)
  return raw === null ? emptyStats() : normaliseStats(raw)
}

export function saveStats(stats: Stats, storage: StorageLike = defaultStorage()): void {
  write(storage, STATS_STORAGE_KEY, stats)
}

export function loadSettings(storage: StorageLike = defaultStorage()): Settings {
  const raw = read(storage, SETTINGS_KEY)
  if (raw === null || typeof raw !== 'object') {
    return defaultSettings()
  }
  const stored = raw as Partial<Settings>
  const theme = stored.theme
  return {
    v: 1,
    theme:
      theme === 'light' || theme === 'dark' || theme === 'contrast' || theme === 'system'
        ? theme
        : 'system',
    onboardingDismissed: stored.onboardingDismissed === true,
  }
}

export function saveSettings(settings: Settings, storage: StorageLike = defaultStorage()): void {
  write(storage, SETTINGS_KEY, settings)
}

/**
 * Writes one JSON value under one key.
 *
 * One key per domain object, never spread across several. `localStorage` has no
 * transaction, so a kill mid-write can tear a multi-key update; keeping each object
 * whole means a torn write loses that object rather than corrupting its neighbours.
 */
function write(storage: StorageLike, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exhausted, or storage disabled. Losing a save is bad; taking the game
    // down over it is worse.
  }
}

function read(storage: StorageLike, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    if (raw === null) {
      return null
    }
    return JSON.parse(raw)
  } catch {
    // Absent, or unparseable because it was truncated or hand-edited. Both are
    // ordinary here.
    return null
  }
}

function isNumberArray(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function isMove(value: unknown): value is Move {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const move = value as Partial<Move>
  return (
    typeof move.cell === 'number' &&
    Number.isInteger(move.cell) &&
    move.cell >= 0 &&
    typeof move.from === 'number' &&
    typeof move.to === 'number' &&
    move.from >= EMPTY &&
    move.to >= EMPTY
  )
}
