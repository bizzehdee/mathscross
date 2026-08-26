/**
 * In-progress game state, with undo and redo. Plan section 8.6.
 *
 * Pure: no DOM, no storage, no clock. The UI reads it and calls into it, and
 * `persist.ts` serialises it, but nothing here knows about either.
 *
 * The puzzle grid is kept separately from the player's values, so a given can
 * never be edited and the two are never confused. A cell is editable exactly when
 * the puzzle left it blank.
 */
import { parseGrid, type ParsedGrid } from '../engine/parse'
import { cloneGrid } from '../engine/grid'
import { CellKind, EMPTY, type Grid } from '../engine/types'
import type { Difficulty } from '../engine/difficulty'

/**
 * One undoable action: a single cell entry or clear.
 *
 * Never a batch. A player who typed one digit expects one undo to remove it.
 */
export interface Move {
  readonly cell: number
  readonly from: number
  readonly to: number
}

/**
 * Undo history cap. Plan section 8.6.
 *
 * 200 is comfortably more than any 9x9 needs — it has 81 cells — and it bounds
 * the stored payload, which matters because the history is persisted alongside
 * the board and `localStorage` is the only place it goes.
 */
export const MAX_HISTORY = 200

export interface GameState {
  readonly difficulty: Difficulty
  /** The puzzle as generated. Blank at every cell the player must fill. */
  readonly puzzle: Grid
  /** The board as it stands, givens included. */
  readonly board: Grid
  readonly parsed: ParsedGrid
  history: Move[]
  /** Number of moves currently applied. Redo is everything past it. */
  historyIndex: number
}

export function createGameState(puzzle: Grid, difficulty: Difficulty): GameState {
  return {
    difficulty,
    puzzle: cloneGrid(puzzle),
    board: cloneGrid(puzzle),
    parsed: parseGrid(puzzle),
    history: [],
    historyIndex: 0,
  }
}

/** Whether the player may type into this cell. Givens and blocks may not. */
export function isEditable(state: GameState, cell: number): boolean {
  const kind = state.puzzle.kinds[cell]
  if (kind !== CellKind.Digit && kind !== CellKind.Operator) {
    return false
  }
  return state.puzzle.values[cell] === EMPTY
}

export type EntryOutcome = 'applied' | 'unchanged' | 'locked'

/**
 * Writes a value into a cell and records it for undo.
 *
 * `EMPTY` clears the cell, which is an ordinary move and is undoable like any
 * other. Writing the value already there is `unchanged` and records nothing: a
 * history full of no-ops would make undo feel broken.
 */
export function enter(state: GameState, cell: number, value: number): EntryOutcome {
  if (!isEditable(state, cell)) {
    return 'locked'
  }
  const from = state.board.values[cell]
  if (from === undefined || from === value) {
    return 'unchanged'
  }

  state.board.values[cell] = value

  // A new move after an undo abandons the branch that was undone.
  state.history.length = state.historyIndex
  state.history.push({ cell, from, to: value })

  if (state.history.length > MAX_HISTORY) {
    // Drop the oldest, not the newest: the recent past is what a player undoes.
    state.history.shift()
  }
  state.historyIndex = state.history.length

  return 'applied'
}

export function clear(state: GameState, cell: number): EntryOutcome {
  return enter(state, cell, EMPTY)
}

export function canUndo(state: GameState): boolean {
  return state.historyIndex > 0
}

export function canRedo(state: GameState): boolean {
  return state.historyIndex < state.history.length
}

/** Reverts one move. Returns the cell affected, or null when there is none. */
export function undo(state: GameState): number | null {
  if (!canUndo(state)) {
    return null
  }
  const move = state.history[state.historyIndex - 1]
  if (move === undefined) {
    return null
  }
  state.board.values[move.cell] = move.from
  state.historyIndex -= 1
  return move.cell
}

/** Reapplies one undone move. Returns the cell affected, or null. */
export function redo(state: GameState): number | null {
  if (!canRedo(state)) {
    return null
  }
  const move = state.history[state.historyIndex]
  if (move === undefined) {
    return null
  }
  state.board.values[move.cell] = move.to
  state.historyIndex += 1
  return move.cell
}

/** Every cell the player still has to fill. */
export function remainingCells(state: GameState): number[] {
  const cells: number[] = []
  for (let cell = 0; cell < state.board.kinds.length; cell += 1) {
    if (isEditable(state, cell) && state.board.values[cell] === EMPTY) {
      cells.push(cell)
    }
  }
  return cells
}
