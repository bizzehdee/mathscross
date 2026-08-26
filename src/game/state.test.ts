import { describe, expect, it } from 'vitest'
import { Difficulty } from '../engine/difficulty'
import { gridFromText } from '../engine/grid'
import { EMPTY } from '../engine/types'
import {
  canRedo,
  canUndo,
  clear,
  createGameState,
  enter,
  isEditable,
  MAX_HISTORY,
  redo,
  remainingCells,
  undo,
} from './state'

/** Easy 5x5 with two blanks: the result cell of each row equation. */
const PUZZLE = `
  1 + 2 = ?
  + # + # +
  2 + 1 = 3
  = # = # =
  3 + 3 = ?
`

function state() {
  return createGameState(gridFromText(PUZZLE), Difficulty.Easy)
}

describe('editability', () => {
  it('allows entry only where the puzzle left a blank', () => {
    const game = state()

    expect(isEditable(game, 4)).toBe(true)
    // A given.
    expect(isEditable(game, 0)).toBe(false)
    // A block.
    expect(isEditable(game, 6)).toBe(false)
    // An equals cell holds no value and is never editable.
    expect(isEditable(game, 3)).toBe(false)
  })

  it('refuses a write to a given, and records no move', () => {
    const game = state()

    expect(enter(game, 0, 9)).toBe('locked')
    expect(game.board.values[0]).toBe(1)
    expect(canUndo(game)).toBe(false)
  })

  it('lists the cells still to fill', () => {
    const game = state()
    expect(remainingCells(game)).toEqual([4, 24])

    enter(game, 4, 3)
    expect(remainingCells(game)).toEqual([24])
  })
})

describe('undo and redo', () => {
  it('reverts exactly one cell entry', () => {
    const game = state()

    enter(game, 4, 3)
    enter(game, 24, 6)
    expect(undo(game)).toBe(24)
    expect(game.board.values[24]).toBe(EMPTY)
    expect(game.board.values[4]).toBe(3)
  })

  it('reapplies an undone entry', () => {
    const game = state()

    enter(game, 4, 3)
    undo(game)
    expect(redo(game)).toBe(4)
    expect(game.board.values[4]).toBe(3)
  })

  it('truncates the redo branch when a new move follows an undo', () => {
    const game = state()

    enter(game, 4, 3)
    undo(game)
    expect(canRedo(game)).toBe(true)

    enter(game, 4, 7)
    expect(canRedo(game)).toBe(false)
    expect(game.board.values[4]).toBe(7)
  })

  it('treats a clear as an ordinary undoable move', () => {
    const game = state()

    enter(game, 4, 3)
    expect(clear(game, 4)).toBe('applied')
    expect(game.board.values[4]).toBe(EMPTY)

    undo(game)
    expect(game.board.values[4]).toBe(3)
  })

  it('records nothing when the value is already there', () => {
    // A history full of no-ops would make undo appear broken: the player presses
    // it and nothing visibly happens.
    const game = state()

    enter(game, 4, 3)
    expect(enter(game, 4, 3)).toBe('unchanged')
    expect(game.history).toHaveLength(1)
  })

  it('caps the history and drops the oldest move', () => {
    const game = state()

    // Alternate values so every write is a real change.
    for (let move = 0; move < MAX_HISTORY + 20; move += 1) {
      enter(game, 4, move % 2 === 0 ? 3 : 4)
    }

    expect(game.history).toHaveLength(MAX_HISTORY)
    expect(game.historyIndex).toBe(MAX_HISTORY)
    // The recent past is what a player undoes, so the newest must survive.
    expect(game.history[MAX_HISTORY - 1]?.to).toBe(game.board.values[4])
  })

  it('does nothing at either end of the history', () => {
    const game = state()

    expect(undo(game)).toBeNull()
    expect(redo(game)).toBeNull()
  })
})
