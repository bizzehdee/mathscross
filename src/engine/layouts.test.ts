/**
 * The layouts, checked against themselves. Plan sections 2.9 and 13.3.
 *
 * Nothing here generates a board. These are the assertions that would have caught
 * the Hard layout at the point it was drawn, rather than as a fill that fails on
 * every seed with a symptom that points at the fill.
 */
import { describe, expect, it } from 'vitest'
import { ALL_DIFFICULTIES, Difficulty, parametersFor } from './difficulty'
import {
  assignWidths,
  cellAt,
  crossingsOf,
  isDigitOffset,
  layoutFor,
  widthOptions,
  widthsUsable,
  type Layout,
  type LayoutEquation,
} from './layouts'

/** Every run of five or more non-block cells, read off the picture. */
function runsIn(layout: Layout): LayoutEquation[] {
  const at = (row: number, column: number): string => layout.rows[row]?.[column] ?? '#'
  const found: LayoutEquation[] = []

  const scan = (orientation: 'row' | 'column'): void => {
    for (let line = 0; line < layout.size; line += 1) {
      let offset = 0
      while (offset < layout.size) {
        const open = orientation === 'row' ? at(line, offset) : at(offset, line)
        if (open === '#') {
          offset += 1
          continue
        }
        const start = offset
        while (
          offset < layout.size &&
          (orientation === 'row' ? at(line, offset) : at(offset, line)) !== '#'
        ) {
          offset += 1
        }
        if (offset - start >= 5) {
          found.push({ orientation, line, start, length: offset - start })
        }
      }
    }
  }

  scan('row')
  scan('column')
  return found
}

function freeCells(layout: Layout): number[] {
  const cells: number[] = []
  for (let row = 0; row < layout.size; row += 1) {
    for (let column = 0; column < layout.size; column += 1) {
      if (layout.rows[row]?.[column] !== '#') {
        cells.push(row * layout.size + column)
      }
    }
  }
  return cells
}

describe('every layout is well formed', () => {
  it.each(ALL_DIFFICULTIES)('%s is square and drawn with two characters', (difficulty) => {
    const layout = layoutFor(difficulty)

    expect(layout.rows).toHaveLength(layout.size)
    for (const row of layout.rows) {
      expect(row).toHaveLength(layout.size)
      expect(row).toMatch(/^[.#]+$/)
    }
  })

  it.each(ALL_DIFFICULTIES)('%s lists exactly the equations its picture holds', (difficulty) => {
    // The list is data the generator reads, and the picture is what a person edits.
    // A grid changed without its list is the defect this catches.
    const layout = layoutFor(difficulty)
    const sort = (equations: readonly LayoutEquation[]): string[] =>
      equations.map((e) => `${e.orientation} ${e.line} ${e.start} ${e.length}`).sort()

    expect(sort(layout.equations)).toEqual(sort(runsIn(layout)))
  })

  it.each(ALL_DIFFICULTIES)('%s covers every non-block cell with an equation', (difficulty) => {
    const layout = layoutFor(difficulty)
    const covered = new Set<number>()
    for (const equation of layout.equations) {
      for (let offset = 0; offset < equation.length; offset += 1) {
        covered.add(cellAt(equation, layout.size, offset))
      }
    }

    expect([...freeCells(layout)].filter((cell) => !covered.has(cell))).toEqual([])
  })

  it.each(ALL_DIFFICULTIES)('%s forms a single connected component', (difficulty) => {
    const layout = layoutFor(difficulty)
    const crossings = crossingsOf(layout)
    const reached = new Set<number>([0])
    let growing = true

    while (growing) {
      growing = false
      for (const crossing of crossings) {
        if (reached.has(crossing.first) !== reached.has(crossing.second)) {
          reached.add(crossing.first)
          reached.add(crossing.second)
          growing = true
        }
      }
    }

    expect(reached.size).toBe(layout.equations.length)
  })

  it.each(ALL_DIFFICULTIES)('%s keeps parallel equations off adjacent lines', (difficulty) => {
    const layout = layoutFor(difficulty)
    for (const orientation of ['row', 'column'] as const) {
      const lines = [
        ...new Set(
          layout.equations.filter((e) => e.orientation === orientation).map((e) => e.line),
        ),
      ].sort((a, b) => a - b)

      for (let index = 1; index < lines.length; index += 1) {
        expect((lines[index] ?? 0) - (lines[index - 1] ?? 0), `${orientation} ${index}`).toBeGreaterThan(1)
      }
    }
  })
})

describe('widths', () => {
  it.each(ALL_DIFFICULTIES)('%s gives every equation at least one usable triple', (difficulty) => {
    for (const equation of layoutFor(difficulty).equations) {
      expect(widthOptions(equation.length, difficulty).length, `${equation.length} cells`).toBeGreaterThan(0)
    }
  })

  it.each(ALL_DIFFICULTIES)('%s admits an assignment putting a digit at every crossing', (difficulty) => {
    const layout = layoutFor(difficulty)
    const widths = assignWidths(layout, difficulty)
    expect(widths).not.toBeNull()

    for (const crossing of crossingsOf(layout)) {
      const first = widths?.[crossing.first]
      const second = widths?.[crossing.second]
      expect(first && isDigitOffset(first, crossing.firstOffset)).toBe(true)
      expect(second && isDigitOffset(second, crossing.secondOffset)).toBe(true)
    }
  })

  // Easy is exempt, and knowing why is the point of the rule. Every one of its nine
  // digit cells is a crossing, so its equations are wholly determined by each other
  // — and it generates in a millisecond anyway, because a board of single digits
  // comes out true by luck often enough that retrying is cheap. Luck stops being
  // cheap the moment a term has more than ten possible values.
  const MULTI_DIGIT = ALL_DIFFICULTIES.filter(
    (difficulty) => parametersFor(difficulty).maxValue > 9,
  )

  it.each(MULTI_DIGIT)('%s leaves every equation a digit cell of its own', (difficulty) => {
    // The fill draws values; an equation whose every digit is fixed by the
    // equations crossing it has nothing to draw and can only come out true by luck.
    // Twelve of those on one board is what made the first Hard layout exhaust the
    // attempt cap on every seed. Plan section 2.9.
    const layout = layoutFor(difficulty)
    const widths = assignWidths(layout, difficulty)
    const owners = new Map<number, number>()

    layout.equations.forEach((equation, index) => {
      const equationWidths = widths?.[index]
      for (let offset = 0; offset < equation.length; offset += 1) {
        if (equationWidths !== undefined && !isDigitOffset(equationWidths, offset)) {
          continue
        }
        const cell = cellAt(equation, layout.size, offset)
        owners.set(cell, (owners.get(cell) ?? 0) + 1)
      }
    })

    layout.equations.forEach((equation, index) => {
      const equationWidths = widths?.[index]
      const own = [...Array(equation.length).keys()].filter(
        (offset) =>
          (equationWidths === undefined || isDigitOffset(equationWidths, offset)) &&
          owners.get(cellAt(equation, layout.size, offset)) === 1,
      )
      expect(own.length, `${equation.orientation} ${equation.line} at ${equation.start}`).toBeGreaterThan(0)
    })
  })

  it('offers one triple per length at Easy and Hard, and three at Medium', () => {
    // Medium's three are why a fixed layout still varies: 3^6 shapes on one picture.
    expect(widthOptions(5, Difficulty.Easy)).toHaveLength(1)
    expect(widthOptions(7, Difficulty.Medium)).toHaveLength(3)
    expect(widthOptions(5, Difficulty.Hard)).toHaveLength(1)
    expect(widthOptions(11, Difficulty.Hard)).toHaveLength(1)
  })

  it('rejects a triple only degenerate arithmetic could satisfy', () => {
    // `1 op 3 op 1` at eleven cells is `d op ddd = d`, which holds only as
    // `0 * 123 = 0` — banned by section 2.7.1. Interval arithmetic admits it, and
    // the fill then fails on that equation on every seed.
    expect(widthsUsable({ left: 1, right: 3, result: 1 }, parametersFor(Difficulty.Hard))).toBe(false)
  })
})

describe('the shape of each board', () => {
  it.each([
    [Difficulty.Easy, 5, 6, 9],
    [Difficulty.Medium, 7, 6, 9],
    [Difficulty.Hard, 11, 14, 24],
  ])('%s is %i x %i with %i equations', (difficulty, size, equations, crossings) => {
    const layout = layoutFor(difficulty)

    expect(layout.size).toBe(size)
    expect(layout.equations).toHaveLength(equations)
    expect(crossingsOf(layout)).toHaveLength(crossings)
  })

  it('matches the difficulty table on grid size', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      expect(layoutFor(difficulty).size, difficulty).toBe(parametersFor(difficulty).size)
    }
  })
})
