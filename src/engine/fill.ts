/**
 * Phase 2: assigning operators and values to a mesh. Plan section 5.2.
 *
 * Takes a mesh with kinds but no values and returns a solved, valid grid, or null
 * when this mesh and seed admit none.
 *
 * ## Why this does not use the solver
 *
 * The first version delegated to `solve`, on the grounds that filling is a search
 * and a second search would duplicate tested code. Measurement at M2 killed that:
 * Easy filled in 1 ms, Medium did not finish, and Hard exhausted the worker.
 *
 * The cause is that `solve` prunes with a forward check that can only reject a
 * *fully assigned* equation. Starting from an empty grid every equation reads
 * `incomplete`, so nothing prunes until a whole equation is filled, and the search
 * degenerates to blind enumeration — 19 digit cells at Medium is 10^19 states.
 *
 * The fix is not a better search. Filling an empty grid is a **construction**
 * problem: pick two operands, compute the result, check it fits. Working one
 * number at a time instead of one digit at a time collapses the space, because a
 * result is derived rather than guessed.
 *
 * `solve` remains exactly right for the job it was written for — uniqueness
 * checking on a mostly-filled grid, where the forward check bites immediately.
 *
 * ## Construct and check, with a draw cap
 *
 * Each equation gets a bounded number of randomised draws rather than an
 * exhaustive enumeration. A draw builds each unknown operand digit by digit,
 * honouring digits already fixed by a crossing equation, then derives the result.
 * Bounded work, deterministic given the seed, and a failed equation just fails the
 * attempt — which the generator's outer loop already handles by trying again.
 */
import {
  parametersFor,
  valueInRange,
  type Difficulty,
  type DifficultyParameters,
} from './difficulty'
import { boardState, readNumber } from './evaluate'
import { cloneGrid } from './grid'
import type { Mesh } from './mesh'
import {
  binaryShape,
  orderEquations,
  parseGrid,
  type BinaryShape,
  type Equation,
  type NumberToken,
  type ParsedGrid,
} from './parse'
import type { Rng } from './rng'
import {
  isDegenerateOperation, solveForMissing, writeNumberIfConsistent } from './numbers'
import { EMPTY, Operator, type Grid } from './types'

export interface FillOptions {
  readonly difficulty: Difficulty
  readonly rng: Rng
  /** Draws per equation before giving up on it. */
  readonly drawsPerEquation?: number
}

export interface FillResult {
  readonly grid: Grid
  readonly parsed: ParsedGrid
}

export const DEFAULT_DRAWS_PER_EQUATION = 400

export function fillMesh(mesh: Mesh, options: FillOptions): FillResult | null {
  const { difficulty, rng } = options
  const draws = options.drawsPerEquation ?? DEFAULT_DRAWS_PER_EQUATION
  const parameters = parametersFor(difficulty)
  const parsed = parseGrid(mesh.grid)

  if (parsed.problems.length > 0) {
    // A structurally illegal mesh is a defect in the mesh builder, not bad luck.
    // `meshProblems` is the cheaper place to catch it.
    return null
  }

  const grid = cloneGrid(mesh.grid)

  for (const equation of orderEquations(parsed)) {
    if (!fillEquation(grid, equation, parameters.operators, rng, draws, difficulty)) {
      return null
    }
  }

  // Everything above works one equation at a time, so a cross-equation mistake
  // would not be caught locally. Cheap to confirm on the finished grid.
  if (boardState(grid, parsed.equations) !== 'solved') {
    return null
  }

  return { grid, parsed }
}


function fillEquation(
  grid: Grid,
  equation: Equation,
  operators: readonly Operator[],
  rng: Rng,
  draws: number,
  difficulty: Difficulty,
): boolean {
  const shape = binaryShape(equation)
  if (shape === null) {
    return false
  }

  const parameters = parametersFor(difficulty)
  const operatorHeld = grid.values[shape.operatorCell]
  const operatorFixed = operatorHeld !== undefined && operatorHeld !== EMPTY

  const snapshot = new Int8Array(grid.values)
  const candidateOperators = operatorFixed
    ? [operatorHeld as Operator]
    : rng.shuffle([...operators])

  // Derive the *widest* term and draw the other two.
  //
  // Always deriving the result looks natural and is badly wrong when the result
  // is narrower than the operands. At Hard the mesh offers patterns such as
  // `ddd op ddd = d`, where two random three-digit operands land on a one-digit
  // result about 1% of the time — and every one of Hard's seven equations has to
  // succeed at once, so the fill never completed at all.
  //
  // The widest term has the most room to absorb whatever the others produce.
  // For that same pattern, drawing `c` in 0..9 and `b` in 100..999 and deriving
  // `a = c + b` succeeds almost every draw.
  const target = widestTerm(shape)

  for (const operator of candidateOperators) {
    for (let draw = 0; draw < draws; draw += 1) {
      grid.values.set(snapshot)
      grid.values[shape.operatorCell] = operator

      const drawn = drawExcept(grid, shape, target, rng, parameters)
      if (drawn === null) {
        continue
      }

      const derived = solveForMissing(operator, drawn)
      if (derived === null || !valueInRange(derived, parameters)) {
        continue
      }
      // Reject the arithmetically true but pointless, such as `9 + 0`. Checked
      // here rather than on the drawn terms alone, because the derived term is an
      // operand for two of the three targets: deriving `a` from `b` and `c`
      // can produce `a` of zero however `b` was drawn.
      const triple = { ...drawn, [target]: derived } as {
        a?: number
        b?: number
        c?: number
      }
      if (
        triple.a !== undefined &&
        triple.b !== undefined &&
        isDegenerateOperation(operator, triple.a, triple.b)
      ) {
        continue
      }
      if (!writeNumberIfConsistent(grid, termOf(shape, target), derived)) {
        continue
      }

      return true
    }
  }

  grid.values.set(snapshot)
  return false
}

type TermName = 'a' | 'b' | 'c'

function termOf(shape: BinaryShape, name: TermName): NumberToken {
  if (name === 'a') {
    return shape.left
  }
  if (name === 'b') {
    return shape.right
  }
  return shape.result
}

/** The term with the most cells. Ties prefer the result, then the left operand. */
function widestTerm(shape: BinaryShape): TermName {
  const widths: readonly [TermName, number][] = [
    ['c', shape.result.cells.length],
    ['a', shape.left.cells.length],
    ['b', shape.right.cells.length],
  ]
  let best: TermName = 'c'
  let bestWidth = -1
  for (const [name, width] of widths) {
    if (width > bestWidth) {
      best = name
      bestWidth = width
    }
  }
  return best
}

/**
 * Draws and writes the two terms that are not the derivation target.
 *
 * Returns the known values keyed for `solveForMissing`, or null when either draw
 * is out of range or contradicts a digit a crossing equation fixed.
 */
function drawExcept(
  grid: Grid,
  shape: BinaryShape,
  target: TermName,
  rng: Rng,
  parameters: DifficultyParameters,
): { a?: number; b?: number; c?: number } | null {
  const known: { a?: number; b?: number; c?: number } = {}

  for (const name of ['a', 'b', 'c'] as const) {
    if (name === target) {
      continue
    }
    const token = termOf(shape, name)
    const value = drawNumber(grid, token, rng)
    if (value === null || !valueInRange(value, parameters)) {
      return null
    }
    if (!writeNumberIfConsistent(grid, token, value)) {
      return null
    }
    known[name] = value
  }

  return known
}

/**
 * A value for one number, honouring digits a crossing equation already fixed.
 *
 * Built digit by digit rather than picked from a range and then checked, so a
 * heavily constrained number costs the same as a free one. A multi-cell number's
 * leading digit starts at 1: no leading zeros. Plan section 2.2.
 */
function drawNumber(grid: Grid, token: NumberToken, rng: Rng): number | null {
  const cells = token.cells
  let value = 0

  for (let position = 0; position < cells.length; position += 1) {
    const cell = cells[position]
    if (cell === undefined) {
      return null
    }
    const held = grid.values[cell]
    let digit: number

    if (held !== undefined && held !== EMPTY) {
      digit = held
      if (position === 0 && cells.length > 1 && digit === 0) {
        // A crossing equation fixed a leading zero. Nothing this equation can
        // choose repairs that, so the attempt is dead.
        return null
      }
    } else if (position === 0 && cells.length > 1) {
      digit = 1 + rng.nextBelow(9)
    } else {
      digit = rng.nextBelow(10)
    }

    value = value * 10 + digit
  }

  return value
}

/**
 * Whether every operand and result sits in the difficulty's range.
 *
 * Checks the numbers a player reads, not the arithmetic's intermediate steps.
 */
export function valuesInRange(grid: Grid, parsed: ParsedGrid, difficulty: Difficulty): boolean {
  const parameters = parametersFor(difficulty)

  for (const equation of parsed.equations) {
    for (const token of equation.tokens) {
      if (token.kind !== 'number') {
        continue
      }
      const reading = readNumber(grid, token)
      if (!reading.ok || !valueInRange(reading.value, parameters)) {
        return false
      }
    }
  }

  return true
}

