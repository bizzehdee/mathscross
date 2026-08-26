/**
 * Phase 1: the skeletal mesh, including operand cell widths. Plan section 5.1.
 *
 * Decides which cells are blocks, digits, operators and equals, and how many
 * digit cells each operand and result occupies. No values are assigned here.
 *
 * ## Why a line-based mesh rather than a recursive branch search
 *
 * The plan describes branching segments off existing ones. Implemented directly
 * that produces meshes whose four constraints — segment length, parallel
 * spacing, full coverage, and single connected component — have to be rechecked
 * and repaired after every branch, and it can wander into dead ends.
 *
 * A mesh built from a set of whole rows and a set of whole columns satisfies all
 * four by construction:
 *
 *   - **Length**: a full line is exactly `size` cells, and every difficulty's
 *     equation-length range includes its own grid size.
 *   - **Spacing**: require the chosen rows to be pairwise non-adjacent, and the
 *     same for columns. Nothing else can be adjacent.
 *   - **Coverage**: a non-block cell is on a chosen row or a chosen column, so
 *     an equation covers it.
 *   - **Connectivity**: with at least one row and one column chosen, every row
 *     equation crosses every column equation.
 *
 * Intersections then equal `rows.length * columns.length`, which makes the
 * intersection range a matter of choosing set sizes rather than of searching.
 *
 * ## The pattern constraint
 *
 * Every equation shares one pattern: the sequence of kinds along a line. At a
 * crossing the row contributes the kind at position `column` and the column
 * contributes the kind at position `row`, so both must agree. Requiring every
 * chosen row and column index to be a *digit* position in the pattern satisfies
 * that, and makes every intersection a digit cell — which is what the masking
 * order in section 5.4 wants, since intersection cells are the ones that survive
 * masking.
 *
 * ## Deliberate limitation: no sign cells
 *
 * The plan has the mesh decide whether a sign cell precedes a result. This
 * implementation does not place sign cells, so no generated result is written
 * negative. Negative *intermediate* values still occur wherever `allowNegative`
 * permits, because `2 - 5 + 8` passes through −3, so the flag is not dead.
 * Placing sign cells would add a fourth kind to the pattern and a width term
 * that is one cell wide but not a digit; the parser, evaluator and solver all
 * support them already, so the generator can adopt them later without changing
 * anything else.
 */
import { parametersFor, type Difficulty, type DifficultyParameters } from './difficulty'
import { cellIndex, createGrid } from './grid'
import type { Rng } from './rng'
import { CellKind, Operator, type Grid } from './types'

/** Cell widths of an equation's two operands and its result. */
export interface Widths {
  readonly left: number
  readonly right: number
  readonly result: number
}

/**
 * One equation's shape along a line: which offsets hold what.
 *
 * `digitOffsets` is every offset holding a digit, in order, so a caller can ask
 * which positions may carry an intersection.
 */
export interface Pattern {
  readonly length: number
  readonly widths: Widths
  readonly kinds: readonly CellKind[]
  readonly digitOffsets: readonly number[]
}

export interface Mesh {
  readonly grid: Grid
  readonly pattern: Pattern
  readonly rows: readonly number[]
  readonly columns: readonly number[]
  readonly intersections: readonly number[]
}

/**
 * Builds the kind sequence for one set of widths.
 *
 * `left op right = result`, so the length is the three widths plus two.
 */
export function patternFor(widths: Widths): Pattern {
  const kinds: CellKind[] = []
  const digitOffsets: number[] = []

  const pushDigits = (count: number): void => {
    for (let index = 0; index < count; index += 1) {
      digitOffsets.push(kinds.length)
      kinds.push(CellKind.Digit)
    }
  }

  pushDigits(widths.left)
  kinds.push(CellKind.Operator)
  pushDigits(widths.right)
  kinds.push(CellKind.Equals)
  pushDigits(widths.result)

  return { length: kinds.length, widths, kinds, digitOffsets }
}

/** How many digits the largest permitted value has. */
function maxDigitsFor(parameters: DifficultyParameters): number {
  return String(Math.max(Math.abs(parameters.minValue), parameters.maxValue)).length
}

/**
 * Every width triple that fits a difficulty exactly.
 *
 * A width of `w` cells holds a number of exactly `w` digits, because a
 * multi-cell number may not carry a leading zero. So a width may not exceed the
 * digit count of the difficulty's largest value, or the mesh would demand a
 * number the range cannot supply.
 */
export function candidatePatterns(parameters: DifficultyParameters): Pattern[] {
  const maxWidth = maxDigitsFor(parameters)
  const patterns: Pattern[] = []

  for (let left = 1; left <= maxWidth; left += 1) {
    for (let right = 1; right <= maxWidth; right += 1) {
      for (let result = 1; result <= maxWidth; result += 1) {
        const length = left + right + result + 2
        if (length !== parameters.size) {
          continue
        }
        if (length < parameters.minEquationLength || length > parameters.maxEquationLength) {
          continue
        }
        const widths = { left, right, result }
        if (!widthsFeasible(widths, parameters)) {
          continue
        }
        patterns.push(patternFor(widths))
      }
    }
  }

  return patterns
}

/** Inclusive value range of a number occupying `width` cells, with no leading zero. */
export function widthRange(width: number): { readonly min: number; readonly max: number } {
  if (width <= 1) {
    return { min: 0, max: 9 }
  }
  return { min: 10 ** (width - 1), max: 10 ** width - 1 }
}

/**
 * Whether any allowed operator can satisfy these widths at all.
 *
 * Filtering on cell count alone admits patterns that are arithmetically
 * impossible, and they are not rare. At Hard, `dd op ddd = dd` fits the nine
 * cells perfectly and can never hold: a three-digit right operand with a
 * two-digit left operand and a two-digit result has no valid operator, because
 * addition and multiplication both overflow the result while subtraction and
 * division both undershoot the operand. The fill then failed on its very first
 * equation, every seed, and Hard never generated at all.
 *
 * Interval arithmetic on the three width ranges. Necessary rather than
 * sufficient — it ignores integrality and exact division — so a surviving pattern
 * may still be hard to fill. It removes the outright impossible, which is what
 * costs whole attempts.
 */
export function widthsFeasible(widths: Widths, parameters: DifficultyParameters): boolean {
  const a = widthRange(widths.left)
  const b = widthRange(widths.right)
  const c = widthRange(widths.result)

  const overlaps = (low: number, high: number): boolean => low <= c.max && high >= c.min

  for (const operator of parameters.operators) {
    switch (operator) {
      case Operator.Plus:
        if (overlaps(a.min + b.min, a.max + b.max)) {
          return true
        }
        break
      case Operator.Minus:
        if (overlaps(a.min - b.max, a.max - b.min)) {
          return true
        }
        break
      case Operator.Times:
        if (overlaps(a.min * b.min, a.max * b.max)) {
          return true
        }
        break
      case Operator.Divide:
        // b.min can be 0 for a one-cell operand; division by zero is rejected at
        // evaluation, so the upper bound uses the smallest non-zero divisor.
        if (overlaps(a.min / Math.max(b.max, 1), a.max / Math.max(b.min, 1))) {
          return true
        }
        break
      default:
        break
    }
  }

  return false
}

/** Subsets of `offsets` of size `size` whose members are pairwise non-adjacent. */
export function nonAdjacentSubsets(
  offsets: readonly number[],
  size: number,
): number[][] {
  const results: number[][] = []

  const walk = (start: number, chosen: number[]): void => {
    if (chosen.length === size) {
      results.push([...chosen])
      return
    }
    for (let index = start; index < offsets.length; index += 1) {
      const offset = offsets[index]
      if (offset === undefined) {
        continue
      }
      const previous = chosen[chosen.length - 1]
      // Parallel equations must not sit in adjacent rows or columns. The
      // intervening line is not required to be blocks — it carries the
      // perpendicular equations' operator and equals cells. Plan section 5.1.
      if (previous !== undefined && offset - previous < 2) {
        continue
      }
      chosen.push(offset)
      walk(index + 1, chosen)
      chosen.pop()
    }
  }

  walk(0, [])
  return results
}

/** A row and column set pairing, with the intersection count it produces. */
interface Layout {
  readonly rows: readonly number[]
  readonly columns: readonly number[]
  readonly intersections: number
}

/**
 * Every layout for a pattern whose intersection count is in range.
 *
 * Sorted by intersection count **ascending**: the fewest intersections that
 * still satisfies the difficulty's minimum.
 *
 * An earlier version sorted descending, on the reasoning from M0.5 that
 * intersection cells are the ones that survive masking, so more of them is
 * better. Measurement at M2 showed that is the wrong lever to pull here.
 * Intersections make the fill harder at a punishing rate: at Hard the top of the
 * range is 25, which on a 9x9 means 45 interlocking digit cells every one of
 * which is doubly constrained, with three-digit operands and division in the
 * operator set. Easy took 3 ms, Medium at 8 intersections took 1053 ms, and Hard
 * at 25 exhausted the test worker.
 *
 * The masking insight from M0.5 still holds — it is just served by the *masking
 * order* in `mask.ts`, which prefers whatever intersection cells exist, rather
 * than by manufacturing more of them here. Satisfy the minimum and stop.
 */
export function candidateLayouts(pattern: Pattern, parameters: DifficultyParameters): Layout[] {
  const layouts: Layout[] = []
  const offsets = pattern.digitOffsets

  for (let rowCount = 1; rowCount <= offsets.length; rowCount += 1) {
    const rowSets = nonAdjacentSubsets(offsets, rowCount)
    if (rowSets.length === 0) {
      continue
    }
    for (let columnCount = 1; columnCount <= offsets.length; columnCount += 1) {
      const intersections = rowCount * columnCount
      if (
        intersections < parameters.minIntersections ||
        intersections > parameters.maxIntersections
      ) {
        continue
      }
      const columnSets = nonAdjacentSubsets(offsets, columnCount)
      for (const rows of rowSets) {
        for (const columns of columnSets) {
          layouts.push({ rows, columns, intersections })
        }
      }
    }
  }

  layouts.sort((a, b) => a.intersections - b.intersections)
  return layouts
}

export interface MeshOptions {
  readonly difficulty: Difficulty
  readonly rng: Rng
}

/**
 * Builds a mesh, or returns null when the difficulty admits none.
 *
 * Null is a configuration fault rather than bad luck: it means no width triple
 * fits the grid size, or no layout reaches the intersection range. A caller
 * should not retry with a different seed.
 */
export function buildMesh({ difficulty, rng }: MeshOptions): Mesh | null {
  const parameters = parametersFor(difficulty)
  const patterns = rng.shuffle(candidatePatterns(parameters))

  for (const pattern of patterns) {
    const layouts = candidateLayouts(pattern, parameters)
    if (layouts.length === 0) {
      continue
    }

    // Take the lowest intersection count that satisfies the minimum, and shuffle
    // only among the layouts sharing that count. Shuffling across counts would
    // reintroduce the expensive dense layouts at random, which is worse than
    // choosing them deliberately: generation time would vary wildly by seed.
    const fewest = layouts[0]?.intersections
    const cheapest = rng.shuffle(layouts.filter((layout) => layout.intersections === fewest))
    const layout = cheapest[0]
    if (layout === undefined) {
      continue
    }

    return paint(parameters.size, pattern, layout)
  }

  return null
}

/** Writes a layout's kinds into a grid. */
function paint(size: number, pattern: Pattern, layout: Layout): Mesh {
  const grid = createGrid(size)
  const rows = new Set(layout.rows)
  const columns = new Set(layout.columns)
  const intersections: number[] = []

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const index = cellIndex(size, row, column)
      const onRow = rows.has(row)
      const onColumn = columns.has(column)

      if (!onRow && !onColumn) {
        continue
      }

      // A cell on a chosen row takes the pattern kind at its column offset; a
      // cell on a chosen column takes the kind at its row offset. Where both
      // apply the two agree, because every chosen index is a digit offset.
      const kind = onRow ? pattern.kinds[column] : pattern.kinds[row]
      if (kind === undefined) {
        continue
      }
      grid.kinds[index] = kind

      if (onRow && onColumn) {
        intersections.push(index)
      }
    }
  }

  return { grid, pattern, rows: layout.rows, columns: layout.columns, intersections }
}

/**
 * Checks a mesh against every structural rule, independent of how it was built.
 *
 * The line-based construction satisfies these by design, so a failure here means
 * the construction is wrong rather than the mesh unlucky. Called by the tests
 * and by the generator, cheaply, because a malformed mesh wastes a whole fill.
 */
export function meshProblems(mesh: Mesh, parameters: DifficultyParameters): string[] {
  const problems: string[] = []
  const { rows, columns, intersections } = mesh

  if (rows.length === 0 || columns.length === 0) {
    problems.push('a mesh needs at least one row and one column equation, or it is disconnected')
  }
  for (let index = 1; index < rows.length; index += 1) {
    if ((rows[index] ?? 0) - (rows[index - 1] ?? 0) < 2) {
      problems.push(`rows ${rows[index - 1]} and ${rows[index]} are adjacent`)
    }
  }
  for (let index = 1; index < columns.length; index += 1) {
    if ((columns[index] ?? 0) - (columns[index - 1] ?? 0) < 2) {
      problems.push(`columns ${columns[index - 1]} and ${columns[index]} are adjacent`)
    }
  }
  if (intersections.length !== rows.length * columns.length) {
    problems.push('intersection count does not match the row and column sets')
  }
  if (
    intersections.length < parameters.minIntersections ||
    intersections.length > parameters.maxIntersections
  ) {
    problems.push(
      `intersections ${intersections.length} outside ${parameters.minIntersections}..${parameters.maxIntersections}`,
    )
  }
  for (const cell of intersections) {
    if (mesh.grid.kinds[cell] !== CellKind.Digit) {
      problems.push(`intersection at ${cell} is not a digit cell`)
    }
  }

  return problems
}
