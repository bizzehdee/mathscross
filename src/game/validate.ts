/**
 * Live per-equation feedback for the board. Plan sections 2.4 and 8.5.
 *
 * Derives what the UI needs to render from the engine's evaluation, and nothing
 * more. The board never evaluates arithmetic itself.
 */
import { boardState, equationState, type BoardState, type EquationState } from '../engine/evaluate'
import type { Equation, NumberToken } from '../engine/parse'
import type { GameState } from './state'

export interface EquationStatus {
  readonly equation: Equation
  readonly state: EquationState
}

export interface BoardStatus {
  readonly board: BoardState
  readonly equations: readonly EquationStatus[]
  /** The state to show on each equation's equals cell, by flat index. */
  readonly markers: ReadonlyMap<number, EquationState>
  /** Cells belonging to at least one unsatisfied equation. */
  readonly unsatisfiedCells: ReadonlySet<number>
}

/**
 * The state of every equation, plus what to mark where.
 *
 * The marker sits on the **equals cell** of each equation. That gives one clear
 * per-equation indicator rather than colouring a whole run, it survives two
 * equations crossing at a digit cell without either claiming that cell, and it
 * gives the non-colour channel section 8.8 requires somewhere natural to live.
 */
export function boardStatus(state: GameState): BoardStatus {
  const equations: EquationStatus[] = []
  const markers = new Map<number, EquationState>()
  const unsatisfiedCells = new Set<number>()

  for (const equation of state.parsed.equations) {
    const status = equationState(state.board, equation)
    equations.push({ equation, state: status })

    const equalsToken = equation.tokens.find((token) => token.kind === 'equals')
    if (equalsToken !== undefined && equalsToken.kind === 'equals') {
      markers.set(equalsToken.cell, status)
    }

    if (status === 'unsatisfied') {
      for (const cell of equation.cells) {
        unsatisfiedCells.add(cell)
      }
    }
  }

  return {
    board: boardState(state.board, state.parsed.equations),
    equations,
    markers,
    unsatisfiedCells,
  }
}

export interface NumberGroup {
  readonly cells: readonly number[]
  /** Position of each cell within its number, keyed by flat index. */
  readonly position: ReadonlyMap<number, number>
}

/**
 * Multi-cell numbers, for the grouping cue in section 8.5.
 *
 * Only numbers of more than one cell are returned: a single digit needs no cue,
 * and drawing one round every digit would make the board noise.
 *
 * A cell can belong to two numbers, one per orientation. Both are returned, and
 * the board draws the cue for each direction separately — otherwise a crossing
 * would silently lose one of its groupings.
 */
export function numberGroups(state: GameState): NumberGroup[] {
  const groups: NumberGroup[] = []

  for (const equation of state.parsed.equations) {
    for (const token of equation.tokens) {
      if (token.kind !== 'number') {
        continue
      }
      const numberToken = token as NumberToken
      if (numberToken.cells.length < 2) {
        continue
      }
      const position = new Map<number, number>()
      numberToken.cells.forEach((cell, index) => position.set(cell, index))
      groups.push({ cells: numberToken.cells, position })
    }
  }

  return groups
}
