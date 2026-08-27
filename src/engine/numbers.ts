/**
 * Reading and writing multi-cell numbers, and the arithmetic on them.
 *
 * Shared by the fill, which constructs values, and the solver, which derives
 * them. Both need the same notions of "does this value fit these cells" and
 * "is this division exact", and two copies would drift.
 */
import type { NumberToken } from './parse'
import { EMPTY, Operator, type Grid } from './types'

/**
 * A value's digits, or null when it does not occupy exactly `width` cells.
 *
 * Negative values return null. A negative needs a sign cell, and the mesh places
 * none, so a negative result cannot be written to the board even where the
 * difficulty permits negative values. Plan section 5.1 records that limitation.
 */
export function digitsOf(value: number, width: number): number[] | null {
  if (value < 0 || !Number.isInteger(value)) {
    return null
  }
  const text = String(value)
  if (text.length !== width) {
    return null
  }
  const digits: number[] = []
  for (const character of text) {
    digits.push(Number(character))
  }
  return digits
}

/** `a op b`, or null when the operation is undefined or not exact. */
export function applyOperator(operator: Operator, a: number, b: number): number | null {
  switch (operator) {
    case Operator.Plus:
      return a + b
    case Operator.Minus:
      return a - b
    case Operator.Times:
      return a * b
    case Operator.Divide:
      if (b === 0 || a % b !== 0) {
        return null
      }
      return a / b
    default:
      return null
  }
}

/**
 * Whether `a op b` is arithmetically true but not worth asking.
 *
 * Reported by a player: an Easy board whose three answers were `1 + 0`, `7 - 0`
 * and `9 + 0`. Every one is correct, and none of them is a question — an identity
 * or an annihilator has a right-hand side the player can copy without doing any
 * arithmetic at all, so it fills a cell without teaching anything.
 *
 * These were over-represented rather than merely possible. The fill draws two
 * terms and derives the third, and zero survives more draws than any other value:
 * it is in range for every difficulty, it never overflows the derived term, and
 * for addition and subtraction it cannot make the result leave the range either.
 * The freest value wins the most draws.
 *
 * Rejected, per operator:
 *
 * - `a + 0`, `0 + b`      — the result is the other operand.
 * - `a - 0`               — likewise.
 * - `a * 0`, `0 * b`      — the result is always zero.
 * - `a * 1`, `1 * b`      — the result is the other operand.
 * - `a / 1`               — likewise.
 * - `0 / b`               — the result is always zero.
 *
 * Deliberately still allowed: `0 - b`, which is how a negative is introduced and
 * is worth asking wherever negatives are in range; `a - a` and `a / a`, which
 * have a constant result but require noticing that the operands match; and a
 * *result* of zero from a genuine operation, such as `7 - 7`.
 *
 * This is a rule about the arithmetic, not about a grade, so it is not a
 * difficulty parameter. No difficulty is improved by `9 + 0`.
 */
export function isDegenerateOperation(operator: Operator, a: number, b: number): boolean {
  switch (operator) {
    case Operator.Plus:
      return a === 0 || b === 0
    case Operator.Minus:
      return b === 0
    case Operator.Times:
      return a === 0 || b === 0 || a === 1 || b === 1
    case Operator.Divide:
      return b === 1 || a === 0
    default:
      return false
  }
}

/** How many cells of a number already hold a digit. */
export function knownDigitCount(grid: Grid, token: NumberToken): number {
  let known = 0
  for (const cell of token.cells) {
    const held = grid.values[cell]
    if (held !== undefined && held !== EMPTY) {
      known += 1
    }
  }
  return known
}

export function isFullyKnown(grid: Grid, token: NumberToken): boolean {
  return knownDigitCount(grid, token) === token.cells.length
}

export function isFullyUnknown(grid: Grid, token: NumberToken): boolean {
  return knownDigitCount(grid, token) === 0
}

/**
 * The value of a fully known number, or null if any digit is missing or it
 * carries a leading zero.
 */
export function knownValue(grid: Grid, token: NumberToken): number | null {
  const cells = token.cells
  let value = 0
  for (let position = 0; position < cells.length; position += 1) {
    const cell = cells[position]
    if (cell === undefined) {
      return null
    }
    const digit = grid.values[cell]
    if (digit === undefined || digit === EMPTY) {
      return null
    }
    if (position === 0 && digit === 0 && cells.length > 1) {
      return null
    }
    value = value * 10 + digit
  }
  return value
}

/**
 * Writes a value's digits, but only if the width fits and every already-filled
 * cell agrees. Returns false and changes nothing otherwise.
 */
export function writeNumberIfConsistent(
  grid: Grid,
  token: NumberToken,
  value: number,
): boolean {
  const digits = digitsOf(value, token.cells.length)
  if (digits === null) {
    return false
  }
  // A multi-cell number may not lead with zero. Plan section 2.2.
  if (token.cells.length > 1 && digits[0] === 0) {
    return false
  }

  for (let position = 0; position < token.cells.length; position += 1) {
    const cell = token.cells[position]
    const digit = digits[position]
    if (cell === undefined || digit === undefined) {
      return false
    }
    const held = grid.values[cell]
    if (held !== undefined && held !== EMPTY && held !== digit) {
      return false
    }
  }

  for (let position = 0; position < token.cells.length; position += 1) {
    const cell = token.cells[position]
    const digit = digits[position]
    if (cell !== undefined && digit !== undefined) {
      grid.values[cell] = digit
    }
  }
  return true
}

/**
 * Solves `a op b = c` for whichever single term is unknown.
 *
 * Returns null when the inverse is undefined or not exact. This is what lets the
 * solver derive a whole number instead of searching its digits, which is the
 * difference between pruning immediately and enumerating.
 */
export function solveForMissing(
  operator: Operator,
  known: { readonly a?: number; readonly b?: number; readonly c?: number },
): number | null {
  const { a, b, c } = known

  if (a !== undefined && b !== undefined) {
    return applyOperator(operator, a, b)
  }

  if (a !== undefined && c !== undefined) {
    switch (operator) {
      case Operator.Plus:
        return c - a
      case Operator.Minus:
        return a - c
      case Operator.Times:
        return a === 0 ? null : c % a === 0 ? c / a : null
      case Operator.Divide:
        return c === 0 ? null : a % c === 0 ? a / c : null
      default:
        return null
    }
  }

  if (b !== undefined && c !== undefined) {
    switch (operator) {
      case Operator.Plus:
        return c - b
      case Operator.Minus:
        return c + b
      case Operator.Times:
        return b === 0 ? null : c % b === 0 ? c / b : null
      case Operator.Divide:
        return c * b
      default:
        return null
    }
  }

  return null
}
