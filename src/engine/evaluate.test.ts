import { describe, expect, it } from 'vitest'
import { boardState, equationState, readNumber } from './evaluate'
import { parseGrid, type NumberToken } from './parse'
import { gridFromText } from './grid'
import { referenceGrid, singleRowGrid } from './test-fixtures'

/** The state of the only equation in a single-row fixture. */
function stateOf(cells: string): string {
  const grid = singleRowGrid(cells)
  const parsed = parseGrid(grid)
  const equation = parsed.equations[0]
  if (equation === undefined) {
    return `no equation: ${parsed.problems.map((p) => p.kind).join(', ')}`
  }
  return equationState(grid, equation)
}

describe('BODMAS', () => {
  it('binds multiplication before addition', () => {
    // The rule the game is built on: normal arithmetic, because a game about
    // arithmetic does not get to invent arithmetic. Plan section 2.5.
    expect(stateOf('5 + 3 * 2 = 1 1')).toBe('satisfied')
  })

  it('rejects the left-to-right reading of the same equation', () => {
    // 16 is (5 + 3) * 2, which is what an implementation ignoring precedence
    // would produce. This test is what stops that regression.
    expect(stateOf('5 + 3 * 2 = 1 6')).toBe('unsatisfied')
  })

  it('binds division before subtraction', () => {
    expect(stateOf('9 - 8 / 4 = 7')).toBe('satisfied')
  })
})

describe('association within a precedence tier', () => {
  // These two are the tests nothing else in the suite would catch: an
  // implementation that folds right to left inside a tier passes every
  // precedence test above and fails only here.

  it('subtracts and adds left to right', () => {
    expect(stateOf('1 0 - 3 + 2 = 9')).toBe('satisfied')
    // Right-to-left would give 10 - (3 + 2) = 5.
    expect(stateOf('1 0 - 3 + 2 = 5')).toBe('unsatisfied')
  })

  it('divides left to right', () => {
    expect(stateOf('8 / 4 / 2 = 1')).toBe('satisfied')
    // Right-to-left would give 8 / (4 / 2) = 4.
    expect(stateOf('8 / 4 / 2 = 4')).toBe('unsatisfied')
  })

  it('multiplies and divides left to right', () => {
    expect(stateOf('6 * 4 / 8 = 3')).toBe('satisfied')
  })
})

describe('exact division', () => {
  it('accepts a division with no remainder', () => {
    expect(stateOf('8 / 4 = 2')).toBe('satisfied')
  })

  it('rejects a division with a remainder', () => {
    expect(stateOf('7 / 4 = 2')).toBe('unsatisfied')
  })

  it('checks exactness per division in precedence order, without reordering', () => {
    // 6 / 4 * 2 is invalid: precedence reaches 6 / 4 first and it is not exact.
    // An implementation that reordered to 6 * 2 / 4 would make it 3 and pass.
    // Plan section 2.5.
    expect(stateOf('6 / 4 * 2 = 3')).toBe('unsatisfied')
  })

  it('rejects division by zero', () => {
    expect(stateOf('8 / 0 = 0')).toBe('unsatisfied')
  })
})

describe('unary minus', () => {
  it('reads a negative result', () => {
    expect(stateOf('9 - 1 2 = - 3')).toBe('satisfied')
  })

  it('reads a negative operand after a binary operator', () => {
    expect(stateOf('5 - - 3 = 8')).toBe('satisfied')
  })

  it('rejects a plus in a sign position', () => {
    // A sign position admits only minus: a unary plus carries no meaning, so the
    // parser marks the cell a sign and the evaluator refuses any other value.
    expect(stateOf('9 - 1 2 = + 3')).toBe('unsatisfied')
  })
})

describe('numbers', () => {
  it('reads adjacent digits as one number', () => {
    const grid = singleRowGrid('1 5 + 3 = 1 8')
    const token = parseGrid(grid).equations[0]?.tokens[0] as NumberToken

    expect(readNumber(grid, token)).toEqual({ ok: true, value: 15 })
  })

  it('rejects a leading zero', () => {
    // Plan section 2.2. 0 5 is not five.
    const grid = singleRowGrid('0 5 + 3 = 8')
    const token = parseGrid(grid).equations[0]?.tokens[0] as NumberToken

    expect(readNumber(grid, token)).toEqual({ ok: false, problem: 'leading-zero' })
    expect(stateOf('0 5 + 3 = 8')).toBe('unsatisfied')
  })

  it('accepts a single zero', () => {
    // The rule is about redundant leading zeros, not about zero.
    expect(stateOf('0 + 3 = 3')).toBe('satisfied')
  })

  it('reports an unfilled digit as incomplete rather than wrong', () => {
    // A half-filled equation is not a mistake yet, and the board must never tell
    // a player their partial work is wrong.
    expect(stateOf('? + 3 = 8')).toBe('incomplete')
  })

  it('reports an unfilled operator as incomplete', () => {
    expect(stateOf('5 @ 3 = 8')).toBe('incomplete')
  })
})

describe('the reference board', () => {
  it('satisfies all six equations', () => {
    const grid = referenceGrid()
    const parsed = parseGrid(grid)

    for (const equation of parsed.equations) {
      expect(equationState(grid, equation)).toBe('satisfied')
    }
  })

  it('is solved', () => {
    const grid = referenceGrid()
    expect(boardState(grid, parseGrid(grid).equations)).toBe('solved')
  })

  it('becomes invalid when one digit is wrong', () => {
    const grid = gridFromText(`
      1 + 2 = 4
      + # + # +
      2 + 1 = 3
      = # = # =
      3 + 3 = 6
    `)
    expect(boardState(grid, parseGrid(grid).equations)).toBe('invalid')
  })

  it('is incomplete while any cell is empty, even if every filled equation holds', () => {
    const grid = gridFromText(`
      1 + 2 = 3
      + # + # +
      2 + 1 = 3
      = # = # =
      3 + 3 = ?
    `)
    expect(boardState(grid, parseGrid(grid).equations)).toBe('incomplete')
  })
})
