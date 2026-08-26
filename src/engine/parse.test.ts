import { describe, expect, it } from 'vitest'
import { isLegal, parseGrid, type NumberToken, type OperatorToken } from './parse'
import { gridFromText } from './grid'
import { referenceGrid, singleRowGrid } from './test-fixtures'
import { CellKind } from './types'

/** Renders an equation's tokens compactly, for readable assertions. */
function shape(tokens: readonly { kind: string }[]): string {
  return tokens
    .map((token) => {
      if (token.kind === 'number') {
        return `n${(token as NumberToken).cells.length}`
      }
      if (token.kind === 'operator') {
        return (token as OperatorToken).role === 'sign' ? 'sign' : 'op'
      }
      return '='
    })
    .join(' ')
}

describe('the reference board', () => {
  it('extracts six equations, three rows and three columns', () => {
    const parsed = parseGrid(referenceGrid())

    expect(parsed.equations).toHaveLength(6)
    expect(parsed.equations.filter((e) => e.orientation === 'row')).toHaveLength(3)
    expect(parsed.equations.filter((e) => e.orientation === 'column')).toHaveLength(3)
    expect(parsed.equations.map((e) => e.line).sort()).toEqual([0, 0, 2, 2, 4, 4])
  })

  it('is legal', () => {
    expect(parseGrid(referenceGrid()).problems).toEqual([])
  })

  it('reads every equation as number, operator, number, equals, number', () => {
    for (const equation of parseGrid(referenceGrid()).equations) {
      expect(shape(equation.tokens)).toBe('n1 op n1 = n1')
    }
  })
})

describe('numbers span cells', () => {
  it('reads adjacent digit cells as one number', () => {
    // Plan section 2.2. This is the rule that makes 1 5 fifteen rather than
    // one and five, and it is the one a player is most likely to misread.
    const parsed = parseGrid(singleRowGrid('1 5 + 3 = 1 8'))
    const equation = parsed.equations[0]

    expect(equation).toBeDefined()
    expect(shape(equation?.tokens ?? [])).toBe('n2 op n1 = n2')
  })

  it('records the leading cell of a multi-cell number', () => {
    const parsed = parseGrid(singleRowGrid('1 5 + 3 = 1 8'))

    // Cells 0 and 5 lead two-cell numbers; cell 3 is a single digit and does not.
    expect([...parsed.leadingDigitCells].sort((a, b) => a - b)).toEqual([0, 5])
  })
})

describe('unary minus', () => {
  it('classifies a minus after an equals as a sign', () => {
    // Plan section 2.3. 9 - 12 = -3: the first minus is binary, the second a sign.
    const parsed = parseGrid(singleRowGrid('9 - 1 2 = - 3'))
    const equation = parsed.equations[0]

    expect(shape(equation?.tokens ?? [])).toBe('n1 op n2 = sign n1')
  })

  it('classifies a minus after another operator as a sign', () => {
    const parsed = parseGrid(singleRowGrid('5 - - 3 = 8'))
    const equation = parsed.equations[0]

    expect(shape(equation?.tokens ?? [])).toBe('n1 op sign n1 = n1')
  })

  it('treats a leading operator as binary, making the equation malformed', () => {
    // A leading minus is not a sign: plan section 2.3 makes a sign a minus that
    // directly follows an equals or another operator, and nothing precedes the
    // first cell. So the equation has no left operand and is rejected.
    const parsed = parseGrid(singleRowGrid('- 3 + 5 = 2'))

    expect(isLegal(parsed)).toBe(false)
    expect(parsed.problems.map((p) => p.kind)).toContain('malformed-equation')
  })
})

describe('grid legality', () => {
  it('accepts a length-one run whose cell a perpendicular equation covers', () => {
    // The rule that an earlier draft got wrong. Every Easy equation is exactly
    // five cells, so in a 5x5 grid every equation is a whole row or column, and
    // any such layout leaves length-one runs in the rows its columns pass
    // through. Rejecting those makes every 5x5 grid unbuildable, so this test
    // is the guard on the whole difficulty. Plan section 2.4.
    const grid = gridFromText(`
      1 + 2 = 3
      + # # # #
      2 # # # #
      = # # # #
      3 # # # #
    `)
    const parsed = parseGrid(grid)

    // Row 0 and column 0 are equations. Rows 1 to 4 each hold exactly one
    // non-block cell, forming four length-one runs.
    expect(parsed.equations).toHaveLength(2)
    expect(parsed.problems).toEqual([])
  })

  it('rejects a cell no equation covers', () => {
    // A three-cell run with no equals, and no column equation over it either.
    const grid = gridFromText(`
      1 + 2 = 3
      # # # # #
      1 + 2 # #
      # # # # #
      # # # # #
    `)
    const parsed = parseGrid(grid)

    const uncovered = parsed.problems.filter((p) => p.kind === 'cell-in-no-equation')
    expect(uncovered).toHaveLength(3)
  })

  it('rejects an equation with no operator', () => {
    const grid = gridFromText(`
      6 = 6 # #
      # # # # #
      # # # # #
      # # # # #
      # # # # #
    `)
    const parsed = parseGrid(grid)

    expect(parsed.problems.map((p) => p.kind)).toContain('equation-without-operator')
  })

  it('rejects a run with two equals cells', () => {
    const grid = gridFromText(`
      1 + 2 = 3 = 3
      # # # # # # #
      # # # # # # #
      # # # # # # #
      # # # # # # #
      # # # # # # #
      # # # # # # #
    `)
    const parsed = parseGrid(grid)

    expect(parsed.problems.map((p) => p.kind)).toContain('equation-needs-one-equals')
  })

  it('ignores a run with no equals when a perpendicular equation covers its cells', () => {
    // The reference board's rows 1 and 3 are exactly this case: they carry
    // operator and equals cells belonging to the column equations, and form no
    // row equation of their own.
    const parsed = parseGrid(referenceGrid())
    const rowLines = parsed.equations.filter((e) => e.orientation === 'row').map((e) => e.line)

    expect(rowLines).not.toContain(1)
    expect(rowLines).not.toContain(3)
    expect(parsed.problems).toEqual([])
  })
})

describe('structure is independent of values', () => {
  it('parses a fully masked grid to the same equations as its solution', () => {
    // The solver relies on this: it computes structure once and reuses it across
    // every search branch.
    const solved = referenceGrid()
    const masked = gridFromText(`
      ? @ ? = ?
      @ # @ # @
      ? @ ? = ?
      = # = # =
      ? @ ? = ?
    `)

    const a = parseGrid(solved)
    const b = parseGrid(masked)

    expect(b.equations).toHaveLength(a.equations.length)
    expect(b.equations.map((e) => shape(e.tokens))).toEqual(a.equations.map((e) => shape(e.tokens)))
    expect(b.problems).toEqual([])
  })
})

describe('the text fixture builder', () => {
  it('distinguishes an empty digit cell from an empty operator cell', () => {
    const grid = gridFromText(`
      ? @ ?
      # # #
      # # #
    `)

    expect(grid.kinds[0]).toBe(CellKind.Digit)
    expect(grid.kinds[1]).toBe(CellKind.Operator)
  })

  it('rejects a board that is not square', () => {
    expect(() => gridFromText('1 + 2\n# #')).toThrow(/square/)
  })

  it('rejects an unrecognised token', () => {
    expect(() => gridFromText('1 x 2\n# # #\n# # #')).toThrow(/Unrecognised/)
  })
})
