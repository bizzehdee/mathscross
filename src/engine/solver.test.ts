import { describe, expect, it } from 'vitest'
import { parametersFor, Difficulty } from './difficulty'
import { hasUniqueSolution, solve } from './solver'
import { gridFromText } from './grid'
import { referenceGrid, singleRowGrid } from './test-fixtures'
import { Operator } from './types'

const EASY = parametersFor(Difficulty.Easy)
const MEDIUM = parametersFor(Difficulty.Medium)
const HARD = parametersFor(Difficulty.Hard)

describe('a single solution', () => {
  it('solves one blank digit', () => {
    const result = solve(singleRowGrid('? + 3 = 8'), { operators: EASY.operators })

    expect(result.count).toBe(1)
    expect(result.first?.[0]).toBe(5)
  })

  it('solves a blank operator', () => {
    // Hard's operator set, because division is the only operator giving three
    // here and Medium does not include it.
    const result = solve(singleRowGrid('9 @ 3 = 3'), { operators: HARD.operators })

    expect(result.count).toBe(1)
    expect(result.first?.[1]).toBe(Operator.Divide)
  })

  it('solves the reference board from a fully masked grid', () => {
    const masked = gridFromText(`
      ? + ? = ?
      + # + # +
      ? + ? = ?
      = # = # =
      ? + ? = ?
    `)
    const result = solve(masked, { operators: EASY.operators, maxSolutions: 2 })

    // Nine blanks with only additions: many boards satisfy this, so the point of
    // the assertion is that the solver finds at least one and stops at the cap.
    expect(result.count).toBeGreaterThan(0)
    expect(result.illegal).toBe(false)
  })

  it('confirms an already-solved board has exactly one solution', () => {
    expect(hasUniqueSolution(referenceGrid(), { operators: EASY.operators })).toBe(true)
  })
})

describe('uniqueness', () => {
  it('finds a second solution and stops', () => {
    // Both 2 + 3 = 5 and 3 + 2 = 5 satisfy this, so it is not unique.
    const result = solve(singleRowGrid('? + ? = 5'), { operators: [Operator.Plus] })

    expect(result.count).toBe(2)
    expect(hasUniqueSolution(singleRowGrid('? + ? = 5'), { operators: [Operator.Plus] })).toBe(false)
  })

  it('reports the M0.5 operator ambiguity', () => {
    // The finding from playtest/boards.md: masking this operator admits both
    // 2 + 32 = 34 and 2 * 32 = 64. It is why an operator mask cannot be treated
    // as cheaper than a digit mask. Plan section 5.4.
    const grid = singleRowGrid('2 @ 3 2 = ? 4')
    const result = solve(grid, { operators: MEDIUM.operators, maxSolutions: 3 })

    expect(result.count).toBe(2)
  })

  it('accepts a mask that a second equation disambiguates', () => {
    // The same ambiguous row, but now a column equation crosses the *blank*
    // tens digit of the result and pins it to 3. That forces the operator to
    // plus, and the row becomes unique.
    //
    // Crossing a given would achieve nothing: it is crossing the blank that
    // removes the ambiguity. That is the structural reason masking order should
    // favour intersection cells, per plan section 5.4 step 2.
    const grid = gridFromText(`
      2 @ 3 2 = ? 4
      # # # # # + #
      # # # # # 3 #
      # # # # # = #
      # # # # # 6 #
      # # # # # # #
      # # # # # # #
    `)
    expect(hasUniqueSolution(grid, { operators: MEDIUM.operators })).toBe(true)
  })
})

describe('no solution', () => {
  it('reports zero solutions rather than hanging', () => {
    // 1 + ? = 0 has no non-negative digit answer, and no Easy operator helps.
    const result = solve(singleRowGrid('1 + ? = 0'), { operators: EASY.operators })

    expect(result.count).toBe(0)
    expect(result.first).toBeNull()
  })

  it('reports an illegal grid without searching', () => {
    const grid = gridFromText(`
      6 = 6 # #
      # # # # #
      # # # # #
      # # # # #
      # # # # #
    `)
    const result = solve(grid)

    expect(result.illegal).toBe(true)
    expect(result.count).toBe(0)
  })
})

describe('leading zeros', () => {
  it('never proposes a leading zero for a multi-cell number', () => {
    // The only arithmetic answer is 9, because 9 + 1 = 10. But the operand has
    // two cells, so writing 9 there needs `0 9`, which section 2.2 forbids.
    // A solver that allowed a leading zero would report one solution here.
    const result = solve(singleRowGrid('? ? + 1 = 1 0'), { operators: [Operator.Plus] })

    expect(result.count).toBe(0)
  })

  it('solves a two-cell operand that needs no leading zero', () => {
    const result = solve(singleRowGrid('? ? + 5 = 2 0'), { operators: [Operator.Plus] })

    expect(result.count).toBe(1)
    expect(result.first?.[0]).toBe(1)
    expect(result.first?.[1]).toBe(5)
  })

  it('still allows a single zero digit', () => {
    const result = solve(singleRowGrid('? + 3 = 3'), { operators: [Operator.Plus] })

    expect(result.count).toBe(1)
    expect(result.first?.[0]).toBe(0)
  })
})

describe('BODMAS in the solver', () => {
  it('solves for an operand under precedence', () => {
    // 5 + ? * 2 = 11 requires the multiplication to bind first, giving 3.
    // A left-to-right solver would answer nothing here, since (5 + x) * 2 = 11
    // has no integer solution.
    const result = solve(singleRowGrid('5 + ? * 2 = 1 1'), { operators: MEDIUM.operators })

    expect(result.count).toBe(1)
    expect(result.first?.[2]).toBe(3)
  })
})

describe('the deduction log', () => {
  it('records direct when arithmetic alone finishes the puzzle', () => {
    const result = solve(singleRowGrid('? + 3 = 8'), { operators: EASY.operators })

    expect(result.techniques.has('direct')).toBe(true)
    expect(result.techniques.has('search')).toBe(false)
  })

  it('records search when branching was needed', () => {
    const result = solve(singleRowGrid('? + ? = 5'), { operators: [Operator.Plus] })

    expect(result.techniques.has('search')).toBe(true)
  })
})

describe('determinism', () => {
  it('returns the same first solution for the same grid', () => {
    // The daily puzzle depends on this: generation must be reproducible, so the
    // solver must not depend on iteration order that could vary.
    const a = solve(singleRowGrid('? + ? = 5'), { operators: [Operator.Plus] })
    const b = solve(singleRowGrid('? + ? = 5'), { operators: [Operator.Plus] })

    expect(Array.from(a.first ?? [])).toEqual(Array.from(b.first ?? []))
  })
})
