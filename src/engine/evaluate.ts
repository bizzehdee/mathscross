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
  const cells = token.cells
  if (cells.length === 0) {
    return { ok: false, problem: 'incomplete' }
  }

  let value = 0
  for (let position = 0; position < cells.length; position += 1) {
    const cell = cells[position]
    if (cell === undefined) {
      return { ok: false, problem: 'incomplete' }
    }
    const digit = grid.values[cell]
    if (digit === undefined || digit === EMPTY) {
      return { ok: false, problem: 'incomplete' }
    }
    if (position === 0 && digit === 0 && cells.length > 1) {
      return { ok: false, problem: 'leading-zero' }
    }
    value = value * 10 + digit
  }
  return { ok: true, value }
}

/** One term of a side: a signed number, with the operator that precedes it. */
interface Term {
  readonly operator: Operator | null
  readonly value: number
}

type SideReading =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly problem: 'incomplete' | 'invalid' }

/**
 * Evaluates one side of an equals.
 *
 * Two passes, which is what makes precedence work without building a tree.
 * The first pass collapses every division and multiplication left to right,
 * leaving only additive terms. The second sums those left to right.
 */
function evaluateSide(grid: Grid, tokens: readonly Token[]): SideReading {
  const terms = readTerms(grid, tokens)
  if (!terms.ok) {
    return terms
  }

  // Pass one: the multiplicative tier, left to right.
  const additive: Term[] = []
  for (const term of terms.terms) {
    if (term.operator === Operator.Times || term.operator === Operator.Divide) {
      const previous = additive.pop()
      if (previous === undefined) {
        return { ok: false, problem: 'invalid' }
      }
      if (term.operator === Operator.Times) {
        additive.push({ operator: previous.operator, value: previous.value * term.value })
        continue
      }
      if (term.value === 0 || previous.value % term.value !== 0) {
        // Division by zero, or a division that is not exact. Checked here, at
        // the point precedence reaches it, never deferred or reordered.
        return { ok: false, problem: 'invalid' }
      }
      additive.push({ operator: previous.operator, value: previous.value / term.value })
      continue
    }
    additive.push(term)
  }

  // Pass two: the additive tier, left to right.
  const first = additive[0]
  if (first === undefined) {
    return { ok: false, problem: 'invalid' }
  }
  let total = first.value
  for (let index = 1; index < additive.length; index += 1) {
    const term = additive[index]
    if (term === undefined) {
      return { ok: false, problem: 'invalid' }
    }
    if (term.operator === Operator.Plus) {
      total += term.value
    } else if (term.operator === Operator.Minus) {
      total -= term.value
    } else {
      return { ok: false, problem: 'invalid' }
    }
  }
  return { ok: true, value: total }
}

type TermsReading =
  | { readonly ok: true; readonly terms: readonly Term[] }
  | { readonly ok: false; readonly problem: 'incomplete' | 'invalid' }

/**
 * Flattens a side's tokens into signed terms.
 *
 * A `sign` operator negates the number that follows it rather than becoming a
 * term of its own, so `5 - -3` yields terms 5 and -3 joined by subtraction.
 */
function readTerms(grid: Grid, tokens: readonly Token[]): TermsReading {
  const terms: Term[] = []
  let pendingOperator: Operator | null = null
  let negate = false
  let expectingNumber = true

  for (const token of tokens) {
    if (token.kind === 'equals') {
      return { ok: false, problem: 'invalid' }
    }

    if (token.kind === 'operator') {
      const value = grid.values[token.cell]
      if (value === undefined || value === EMPTY) {
        return { ok: false, problem: 'incomplete' }
      }
      const operator = value as Operator

      if ((token as OperatorToken).role === 'sign') {
        if (operator !== Operator.Minus) {
          // A sign position admits only minus. Plan section 2.3.
          return { ok: false, problem: 'invalid' }
        }
        negate = true
        continue
      }

      if (expectingNumber) {
        return { ok: false, problem: 'invalid' }
      }
      pendingOperator = operator
      expectingNumber = true
      continue
    }

    const reading = readNumber(grid, token)
    if (!reading.ok) {
      return reading.problem === 'incomplete'
        ? { ok: false, problem: 'incomplete' }
        : { ok: false, problem: 'invalid' }
    }

    terms.push({ operator: pendingOperator, value: negate ? -reading.value : reading.value })
    pendingOperator = null
    negate = false
    expectingNumber = false
  }

  if (expectingNumber || terms.length === 0) {
    return { ok: false, problem: 'invalid' }
  }
  return { ok: true, terms }
}

/**
 * The state of one equation.
 *
 * `incomplete` outranks `unsatisfied`: a half-filled equation is not wrong yet,
 * and the board must not tell a player their partial work is a mistake.
 */
export function equationState(grid: Grid, equation: Equation): EquationState {
  const equalsAt = equation.tokens.findIndex((token) => token.kind === 'equals')
  if (equalsAt === -1) {
    return 'unsatisfied'
  }

  const left = evaluateSide(grid, equation.tokens.slice(0, equalsAt))
  const right = evaluateSide(grid, equation.tokens.slice(equalsAt + 1))

  if (!left.ok && left.problem === 'incomplete') {
    return 'incomplete'
  }
  if (!right.ok && right.problem === 'incomplete') {
    return 'incomplete'
  }
  if (!left.ok || !right.ok) {
    return 'unsatisfied'
  }
  return left.value === right.value ? 'satisfied' : 'unsatisfied'
}

/** The value of one side, for callers that need it rather than a comparison. */
export function sideValue(grid: Grid, equation: Equation, side: 'left' | 'right'): SideReading {
  const equalsAt = equation.tokens.findIndex((token) => token.kind === 'equals')
  if (equalsAt === -1) {
    return { ok: false, problem: 'invalid' }
  }
  const tokens =
    side === 'left' ? equation.tokens.slice(0, equalsAt) : equation.tokens.slice(equalsAt + 1)
  return evaluateSide(grid, tokens)
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
