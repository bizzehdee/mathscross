/**
 * Phase 4: masking cells to make a puzzle. Plan section 5.4.
 *
 * Takes a solved grid and blanks cells one at a time, keeping exactly one
 * solution, up to the difficulty's targets.
 *
 * Three rules, all of them measured rather than assumed:
 *
 *   1. **Operators are masked before digits.** Uniqueness is a budget, and
 *      whichever kind is masked first spends it. With digits first, Hard reached
 *      only 14% of its operator target while Medium reached 40% — the ladder
 *      inverted on its most distinctive dimension. Reversing the order took Hard
 *      to the full 100%, and made it faster too, because a denser grid settles a
 *      uniqueness check sooner. Operators are the scarce resource: there are a
 *      handful per grid against dozens of digits, and each carries far more
 *      difficulty.
 *   2. **Order within a kind is weighted towards intersection cells.** A cell only
 *      one equation crosses is weakly constrained, and masking it is usually what
 *      destroys uniqueness. Every mask that had to be given back when a board was
 *      built by hand at M0.5 was a single-equation cell.
 *   3. **An operator mask is not cheaper than a digit mask.** Usually arithmetic
 *      and cell width force the operator, but not always: `2 ? 32 = ?4` admits
 *      both `2 + 32 = 34` and `2 * 32 = 64`, because two operators can agree on
 *      the result's digit count *and* its final digit. So it gets the same
 *      uniqueness check, and on failure the operator is restored.
 *
 * See `.learnings/masking-is-limited-by-weakly-constrained-cells.md` and
 * `.learnings/generation-measurements.md`.
 */
import { parametersFor, type Difficulty } from './difficulty'
import { cloneGrid } from './grid'
import type { ParsedGrid } from './parse'
import type { Rng } from './rng'
import { hasUniqueSolution } from './solver'
import { CellKind, EMPTY, type Grid } from './types'

export interface MaskOptions {
  readonly difficulty: Difficulty
  readonly rng: Rng
  readonly parsed: ParsedGrid
  /** Aborts a long mask loop. Checked between candidates. */
  readonly shouldCancel?: () => boolean
}

/** What masking achieved, against what it was aiming for. */
export interface MaskDensity {
  readonly digitsMasked: number
  readonly digitsTotal: number
  readonly digitRatio: number
  readonly digitTarget: number
  readonly operatorsMasked: number
  readonly operatorsTotal: number
  readonly operatorRatio: number
  readonly operatorTarget: number
  /** Solver calls spent. The masking loop dominates generation cost. */
  readonly uniquenessChecks: number
}

export interface MaskResult {
  readonly grid: Grid
  readonly density: MaskDensity
}

export function maskGrid(solved: Grid, options: MaskOptions): MaskResult {
  const { difficulty, rng, parsed, shouldCancel } = options
  const parameters = parametersFor(difficulty)
  const grid = cloneGrid(solved)

  const digitCells: number[] = []
  const operatorCells: number[] = []
  for (let cell = 0; cell < grid.kinds.length; cell += 1) {
    if (grid.kinds[cell] === CellKind.Digit) {
      digitCells.push(cell)
    } else if (grid.kinds[cell] === CellKind.Operator) {
      operatorCells.push(cell)
    }
  }

  const digitTarget = Math.round(digitCells.length * parameters.digitMaskRatio)
  const operatorTarget = Math.round(operatorCells.length * parameters.operatorMaskRatio)

  let checks = 0
  const tryMask = (cell: number): boolean => {
    const held = grid.values[cell]
    if (held === undefined || held === EMPTY) {
      return false
    }
    grid.values[cell] = EMPTY
    checks += 1
    if (hasUniqueSolution(grid, { operators: parameters.operators, parsed })) {
      return true
    }
    grid.values[cell] = held
    return false
  }

  let operatorsMasked = 0
  for (const cell of maskOrder(operatorCells, parsed, rng)) {
    if (operatorsMasked >= operatorTarget) {
      break
    }
    if (shouldCancel?.() === true) {
      break
    }
    if (tryMask(cell)) {
      operatorsMasked += 1
    }
  }

  let digitsMasked = 0
  for (const cell of maskOrder(digitCells, parsed, rng)) {
    if (digitsMasked >= digitTarget) {
      break
    }
    if (shouldCancel?.() === true) {
      break
    }
    if (tryMask(cell)) {
      digitsMasked += 1
    }
  }

  return {
    grid,
    density: {
      digitsMasked,
      digitsTotal: digitCells.length,
      digitRatio: digitCells.length === 0 ? 0 : digitsMasked / digitCells.length,
      digitTarget: parameters.digitMaskRatio,
      operatorsMasked,
      operatorsTotal: operatorCells.length,
      operatorRatio: operatorCells.length === 0 ? 0 : operatorsMasked / operatorCells.length,
      operatorTarget: parameters.operatorMaskRatio,
      uniquenessChecks: checks,
    },
  }
}

/**
 * Candidate order: cells in more equations first, shuffled within each group.
 *
 * The grouping is the weighting from M0.5. The shuffle inside a group is what
 * keeps puzzles from the same mesh different from each other.
 */
export function maskOrder(
  cells: readonly number[],
  parsed: ParsedGrid,
  rng: Rng,
): number[] {
  const byCount = new Map<number, number[]>()

  for (const cell of cells) {
    const count = parsed.equationsByCell[cell]?.length ?? 0
    const group = byCount.get(count)
    if (group === undefined) {
      byCount.set(count, [cell])
    } else {
      group.push(cell)
    }
  }

  const counts = [...byCount.keys()].sort((a, b) => b - a)
  const ordered: number[] = []
  for (const count of counts) {
    ordered.push(...rng.shuffle(byCount.get(count) ?? []))
  }
  return ordered
}

/**
 * Whether achieved density is close enough to target.
 *
 * Uniqueness always wins over density, so a shortfall is not a defect in itself.
 * A *large* shortfall is: it means the difficulty is no longer the difficulty it
 * claims to be, and at Hard it is how Hard quietly becomes Medium. The slow suite
 * asserts this.
 *
 * Do not widen `tolerance` to make an assertion pass. Fix the masking order or
 * the mesh's intersection density instead. Plan section 5.4.
 */
export function densityWithinTolerance(density: MaskDensity, tolerance = 0.1): boolean {
  const digitShortfall = density.digitTarget - density.digitRatio
  const operatorShortfall = density.operatorTarget - density.operatorRatio
  return digitShortfall <= tolerance && operatorShortfall <= tolerance
}

/**
 * Whether a *population* of puzzles hits its density targets.
 *
 * Assert this rather than the per-puzzle check above. Individual density varies
 * with the mesh and the seed — measured over 60 seeds, about a quarter of
 * legitimate puzzles sit more than 10 points under target while the median sits
 * within 3 — so a per-puzzle assertion fails constantly without indicating
 * anything. What matters is the systemic case: a difficulty whose whole
 * distribution has slipped is no longer the difficulty it claims to be, and at
 * Hard that is how Hard quietly becomes Medium.
 *
 * Do not widen `tolerance` to make this pass. Fix the masking order, the mesh, or
 * the target itself. Plan section 5.4.
 */
export function medianDensityWithinTolerance(
  densities: readonly MaskDensity[],
  tolerance = 0.1,
): boolean {
  if (densities.length === 0) {
    return true
  }
  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 0
  }

  const digitRatio = median(densities.map((density) => density.digitRatio))
  const operatorRatio = median(densities.map((density) => density.operatorRatio))
  const digitTarget = densities[0]?.digitTarget ?? 0
  const operatorTarget = densities[0]?.operatorTarget ?? 0

  return digitTarget - digitRatio <= tolerance && operatorTarget - operatorRatio <= tolerance
}
