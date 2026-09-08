/**
 * Evaluating equations. Plan section 2.5.
 *
 * Standard BODMAS: division and multiplication bind before addition and
 * subtraction, and within one tier evaluation runs left to right.
 *
 * This is not a preference and must not be traded for a simpler fold. A game
 * whose subject is arithmetic does not get to invent arithmetic: a player who
 * applies what school taught must be told they are right. Getting this wrong
 * either marks correct answers wrong, or teaches a rule the player has to
 * unlearn later. Plan section 2.5 records the reasoning in full.
 *
 * Two details are easy to lose in a refactor, and each has a test that nothing
 * else in the suite would catch:
 *
 *   - Association within a tier is left to right. `10 - 3 + 2` is 9, not 5, and
 *     `8 / 4 / 2` is 1, not 4.
 *   - Exactness is checked per division, in precedence order. `6 / 4 * 2` is
 *     invalid because `6 / 4` is evaluated first and is not exact, even though
 *     `6 * 2 / 4` would be 3. Never reorder to make a division come out.
 */
import type { Equation, NumberToken, OperatorToken, Token } from './parse'
import { CellKind, EMPTY, Operator, type Grid } from './types'

export type EquationState = 'satisfied' | 'unsatisfied' | 'incomplete'

/** Why a number could not be read. */
export type NumberProblem = 'incomplete' | 'leading-zero'

export type NumberReading = { readonly ok: true; readonly value: number } | {
  readonly ok: false
  readonly problem: NumberProblem
}

/**
 * Reads the digits of one number token.
 *
 * A leading zero is rejected rather than silently accepted, so `[0][5]` is not
 * five. Single `0` is legal: the rule is about redundant leading zeros, not
 * about zero. Plan section 2.2.
 */
export function readNumber(grid: Grid, token: NumberToken): NumberReading {
  const value = readNumberValue(grid, token)
  if (value >= 0) {
    return { ok: true, value }
  }
  return { ok: false, problem: value === -2 ? 'leading-zero' : 'incomplete' }
}

type SideReading =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly problem: 'incomplete' | 'invalid' }

/**
 * Whether the last `evaluateSideValue` succeeded, and why it did not.
 *
 * Module scope rather than a returned object, because the solver evaluates
 * equations millions of times a board and an allocation per call was the largest
 * single cost in it. Safe because nothing here re-enters: `evaluateSideValue`
 * calls no evaluator, and the value is read immediately by its caller.
 */
let sideOk = true
let sideProblem: 'incomplete' | 'invalid' = 'invalid'

/**
 * Reads one number as a value, or a negative marker.
 *
 * `-1` is incomplete and `-2` is a leading zero. A number is never negative — a
 * sign is a token of its own — so a negative return is unambiguous.
 */
function readNumberValue(grid: Grid, token: NumberToken): number {
  const cells = token.cells
  const length = cells.length
  if (length === 0) {
    return -1
  }

  let value = 0
  for (let position = 0; position < length; position += 1) {
    const cell = cells[position]
    if (cell === undefined) {
      return -1
    }
    const digit = grid.values[cell]
    if (digit === undefined || digit === EMPTY) {
      return -1
    }
    if (position === 0 && digit === 0 && length > 1) {
      return -2
    }
    value = value * 10 + digit
  }
  return value
}

/** Whether the last `evaluateSideValue` produced a usable value. */
export function lastSideOk(): boolean {
  return sideOk
}

/**
 * Evaluates one side of an equals. Check `lastSideOk` before using the result.
 *
 * Exported for the solver, which evaluates one side at a time: when it is trying
 * candidate values for a single empty cell, only the side holding that cell can
 * change, so the other is evaluated once and compared against.
 *
 * Three running values and no arrays: `total` is the additive tier so far,
 * `pending` the operator waiting to join the next term to it, and `current` the
 * multiplicative chain being built. A `*` or `/` folds into `current` as it is
 * read; a `+` or `-` closes `current` into `total`. That is the same left-to-right
 * association within each tier the two-pass version had, without the term list.
 *
 * An earlier attempt kept the two passes and reused module-level scratch arrays
 * instead of allocating them. It was *slower* than the allocating version it
 * replaced — a shared growable array is not free to write to. Local numbers are.
 *
 * A `sign` operator negates the number that follows rather than becoming a term
 * of its own, so `5 - -3` reads as 5 and -3 joined by subtraction.
 */
export function evaluateSideValue(grid: Grid, tokens: readonly Token[]): number {
  sideOk = true

  let total = 0
  let current = 0
  let started = false
  /** The additive operator joining `current` to `total`, null for the first term. */
  let joining: Operator | null = null
  let pending: Operator | null = null
  let negate = false
  let expectingNumber = true

  for (const token of tokens) {
    if (token.kind === 'equals') {
      sideOk = false
      sideProblem = 'invalid'
      return 0
    }

    if (token.kind === 'operator') {
      const held = grid.values[token.cell]
      if (held === undefined || held === EMPTY) {
        sideOk = false
        sideProblem = 'incomplete'
        return 0
      }
      const operator = held as Operator

      if ((token as OperatorToken).role === 'sign') {
        if (operator !== Operator.Minus) {
          // A sign position admits only minus. Plan section 2.3.
          sideOk = false
          sideProblem = 'invalid'
          return 0
        }
        negate = true
        continue
      }

      if (expectingNumber) {
        sideOk = false
        sideProblem = 'invalid'
        return 0
      }
      pending = operator
      expectingNumber = true
      continue
    }

    const read = readNumberValue(grid, token)
    if (read < 0) {
      sideOk = false
      sideProblem = read === -1 ? 'incomplete' : 'invalid'
      return 0
    }

    const value = negate ? -read : read
    negate = false
    expectingNumber = false

    if (!started) {
      current = value
      started = true
      pending = null
      continue
    }

    if (pending === Operator.Times) {
      current *= value
    } else if (pending === Operator.Divide) {
      if (value === 0 || current % value !== 0) {
        // Division by zero, or a division that is not exact. Checked here, at the
        // point precedence reaches it, never deferred or reordered.
        sideOk = false
        sideProblem = 'invalid'
        return 0
      }
      current /= value
    } else if (pending === Operator.Plus || pending === Operator.Minus) {
      total = joining === Operator.Minus ? total - current : total + current
      joining = pending
      current = value
    } else {
      sideOk = false
      sideProblem = 'invalid'
      return 0
    }

    pending = null
  }

  if (expectingNumber || !started) {
    sideOk = false
    sideProblem = 'invalid'
    return 0
  }

  return joining === Operator.Minus ? total - current : total + current
}

/** The allocating form, for callers outside the solver's hot path. */
function evaluateSide(grid: Grid, tokens: readonly Token[]): SideReading {
  const value = evaluateSideValue(grid, tokens)
  return sideOk ? { ok: true, value } : { ok: false, problem: sideProblem }
}

/**
 * The state of one equation.
 *
 * `incomplete` outranks `unsatisfied`: a half-filled equation is not wrong yet,
 * and the board must not tell a player their partial work is a mistake.
 */
export function equationState(grid: Grid, equation: Equation): EquationState {
  if (equation.rightTokens.length === 0) {
    return 'unsatisfied'
  }

  // `incomplete` outranks `unsatisfied`, so a failure on the left still has to
  // look at the right: an invalid left and an incomplete right reads incomplete.
  const left = evaluateSideValue(grid, equation.leftTokens)
  const leftProblem = sideOk ? null : sideProblem

  const right = evaluateSideValue(grid, equation.rightTokens)
  if (!sideOk) {
    return sideProblem === 'incomplete' || leftProblem === 'incomplete'
      ? 'incomplete'
      : 'unsatisfied'
  }
  if (leftProblem !== null) {
    return leftProblem === 'incomplete' ? 'incomplete' : 'unsatisfied'
  }

  return left === right ? 'satisfied' : 'unsatisfied'
}

/** The value of one side, for callers that need it rather than a comparison. */
export function sideValue(grid: Grid, equation: Equation, side: 'left' | 'right'): SideReading {
  if (equation.rightTokens.length === 0) {
    return { ok: false, problem: 'invalid' }
  }
  return evaluateSide(grid, side === 'left' ? equation.leftTokens : equation.rightTokens)
}

export type BoardState = 'solved' | 'invalid' | 'incomplete'

/**
 * The state of a whole board. Plan section 2.4's three states.
 *
 * A board is `incomplete` while any non-block cell is empty, whatever the filled
 * equations say, so a player is never told the board is wrong for work they have
 * not done.
 */
export function boardState(grid: Grid, equations: readonly Equation[]): BoardState {
  for (let index = 0; index < grid.kinds.length; index += 1) {
    const kind = grid.kinds[index]
    if ((kind === CellKind.Digit || kind === CellKind.Operator) && grid.values[index] === EMPTY) {
      return 'incomplete'
    }
  }

  for (const equation of equations) {
    if (equationState(grid, equation) !== 'satisfied') {
      return 'invalid'
    }
  }
  return 'solved'
}
