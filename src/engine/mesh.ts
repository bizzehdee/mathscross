/**
 * Phase 1: painting a layout and assigning its widths. Plan section 5.1.
 *
 * There is no mesh search. Section 2.9 fixes one layout per difficulty, and this
 * module turns one into a grid of cell kinds: which cells are blocks, digits,
 * operators and equals, and how many digit cells each operand and result occupies.
 * No values are assigned here.
 *
 * ## What replaced the search, and why
 *
 * The plan first described branching segments off existing ones, then a line-based
 * mesh built from whole rows and columns. Both produced shapes nobody had looked
 * at, chosen by seed from a space whose interesting members were few: a 5 x 5 with
 * 5-cell equations has very little room to differ. The search also had to satisfy
 * coverage, connectivity, spacing and intersection count on every attempt, and it
 * spent most of its time rediscovering that the same handful of shapes were legal.
 *
 * A drawn layout satisfies all four by construction, checked once in
 * `layouts.test.ts` rather than per attempt. What is left here is a paint and a
 * width assignment.
 *
 * ## Widths are the part that can still go wrong
 *
 * Where a row and a column equation cross, the shared cell has to be a digit cell
 * in *both*. An equation that puts its operator or its equals there makes the
 * layout unfillable, and section 2.9 records the Hard layout that did exactly that.
 * `assignWidths` backtracks over the crossings to find an assignment, and returns
 * null when the layout admits none — a defect in the layout, not bad luck.
 *
 * ## Deliberate limitation: no sign cells
 *
 * No layout places a sign cell, so no generated result is written negative, and an
 * equation is exactly `A op B = C` with one operator, so no intermediate can be
 * negative either. `allowNegative` therefore changes nothing today. The parser,
 * evaluator and solver all handle sign cells already, so a layout may declare one
 * later without changing anything else. Plan sections 2.9 and 17.
 */
import { type Difficulty } from './difficulty'
import { cellIndex, createGrid } from './grid'
import {
  assignWidths,
  cellAt,
  crossingsOf,
  isDigitOffset,
  layoutFor,
  type Layout,
  type LayoutEquation,
} from './layouts'
import type { Rng } from './rng'
import { CellKind, type Grid, type Widths } from './types'

export interface Mesh {
  readonly grid: Grid
  readonly layout: Layout
  /** Widths per equation, parallel to `layout.equations`. */
  readonly widths: readonly Widths[]
  /** Flat indices of the cells two equations share. */
  readonly intersections: readonly number[]
}

export interface MeshOptions {
  readonly difficulty: Difficulty
  readonly rng: Rng
}

/**
 * Builds a mesh, or returns null when the layout admits no width assignment.
 *
 * Null is a configuration fault rather than bad luck, so a caller should not retry
 * with a different seed. The layout tests assert it cannot happen.
 */
export function buildMesh({ difficulty, rng }: MeshOptions): Mesh | null {
  const layout = layoutFor(difficulty)
  const widths = assignWidths(layout, difficulty, (options) => rng.shuffle([...options]))
  if (widths === null) {
    return null
  }

  const grid = createGrid(layout.size)
  for (let index = 0; index < layout.equations.length; index += 1) {
    const equation = layout.equations[index]
    const equationWidths = widths[index]
    if (equation === undefined || equationWidths === undefined) {
      return null
    }
    paint(grid, layout.size, equation, equationWidths)
  }

  const intersections = crossingsOf(layout).map((crossing) => {
    const equation = layout.equations[crossing.first]
    return equation === undefined ? -1 : cellAt(equation, layout.size, crossing.firstOffset)
  })

  return { grid, layout, widths, intersections }
}

/** Writes one equation's cell kinds into the grid. */
function paint(grid: Grid, size: number, equation: LayoutEquation, widths: Widths): void {
  for (let offset = 0; offset < equation.length; offset += 1) {
    const cell = cellAt(equation, size, offset)
    grid.kinds[cell] = kindAt(widths, offset)
  }
}

function kindAt(widths: Widths, offset: number): CellKind {
  if (offset === widths.left) {
    return CellKind.Operator
  }
  if (offset === widths.left + widths.right + 1) {
    return CellKind.Equals
  }
  return CellKind.Digit
}

/**
 * Checks a painted mesh against the layout it came from.
 *
 * Everything structural about a layout — coverage, connectivity, spacing, equation
 * lengths — is a property of the picture and is asserted once in `layouts.test.ts`.
 * What is left to check per board is the part that depends on the widths, and it is
 * checked because a malformed mesh would otherwise waste a whole fill.
 */
export function meshProblems(mesh: Mesh): string[] {
  const problems: string[] = []
  const { grid, layout } = mesh

  for (let row = 0; row < layout.size; row += 1) {
    for (let column = 0; column < layout.size; column += 1) {
      const drawnBlock = layout.rows[row]?.[column] === '#'
      const paintedBlock = grid.kinds[cellIndex(layout.size, row, column)] === CellKind.Block
      if (drawnBlock !== paintedBlock) {
        problems.push(`cell ${row},${column} is ${paintedBlock ? 'painted' : 'drawn'} as a block only`)
      }
    }
  }

  for (const crossing of crossingsOf(layout)) {
    const first = mesh.widths[crossing.first]
    const second = mesh.widths[crossing.second]
    if (
      first === undefined ||
      second === undefined ||
      !isDigitOffset(first, crossing.firstOffset) ||
      !isDigitOffset(second, crossing.secondOffset)
    ) {
      problems.push(`equations ${crossing.first} and ${crossing.second} disagree where they cross`)
    }
  }

  return problems
}
