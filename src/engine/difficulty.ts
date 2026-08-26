/**
 * The difficulty parameter table. Plan section 2.7.
 *
 * The single place these numbers live. Do not restate any of them in the
 * generator, the solver or the UI: read them from here.
 */
import { Operator, type Grid } from './types'

export const Difficulty = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard',
} as const

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty]

export const ALL_DIFFICULTIES: readonly Difficulty[] = [
  Difficulty.Easy,
  Difficulty.Medium,
  Difficulty.Hard,
]

export interface DifficultyParameters {
  /** Grid side length. Grids are always square. */
  readonly size: number
  /** Inclusive bounds on the cell length of one equation. */
  readonly minEquationLength: number
  readonly maxEquationLength: number
  readonly operators: readonly Operator[]
  /**
   * Inclusive bounds on any operand or result.
   *
   * Derived from the equation length rather than chosen, because one digit per
   * cell means magnitude follows cell width. Plan section 2.6 records that the
   * original specification's Easy and Medium figures are unreachable, and that
   * this is accepted rather than worked around.
   */
  readonly minValue: number
  readonly maxValue: number
  /** Inclusive bounds on the number of cells shared by two equations. */
  readonly minIntersections: number
  readonly maxIntersections: number
  /** Whether an operand or result may be negative. */
  readonly allowNegative: boolean
  /** Target proportion of digit cells to mask. A target, never a guarantee. */
  readonly digitMaskRatio: number
  /** Target proportion of operator cells to mask. */
  readonly operatorMaskRatio: number
}

const EASY: DifficultyParameters = {
  size: 5,
  minEquationLength: 5,
  maxEquationLength: 5,
  operators: [Operator.Plus, Operator.Minus],
  minValue: 0,
  maxValue: 9,
  minIntersections: 2,
  maxIntersections: 4,
  allowNegative: false,
  digitMaskRatio: 0.4,
  operatorMaskRatio: 0,
}

const MEDIUM: DifficultyParameters = {
  size: 7,
  minEquationLength: 5,
  maxEquationLength: 7,
  operators: [Operator.Plus, Operator.Minus, Operator.Times],
  minValue: -99,
  maxValue: 99,
  minIntersections: 5,
  maxIntersections: 8,
  allowNegative: true,
  digitMaskRatio: 0.6,
  operatorMaskRatio: 0.3,
}

const HARD: DifficultyParameters = {
  size: 9,
  minEquationLength: 5,
  maxEquationLength: 9,
  operators: [Operator.Plus, Operator.Minus, Operator.Times, Operator.Divide],
  minValue: -999,
  maxValue: 999,
  minIntersections: 10,
  // A 9x9 whose equations sit on rows and columns 0, 2, 4, 6 and 8 has 25
  // intersections, which is the structural maximum. Stated as a bound so the
  // mesh has a range to satisfy rather than an open-ended target.
  maxIntersections: 25,
  allowNegative: true,
  digitMaskRatio: 0.75,
  // Provisional. Plan section 2.7 demotes 100% operator masking to a hypothesis:
  // untested against enjoyment, and untested against whether uniqueness survives
  // it. M0.5 already found one case where it does not — `2 ? 32 = ?4` admits both
  // `+` and `*` — so expect this to settle lower at M4.
  operatorMaskRatio: 1,
}

const TABLE: Readonly<Record<Difficulty, DifficultyParameters>> = {
  [Difficulty.Easy]: EASY,
  [Difficulty.Medium]: MEDIUM,
  [Difficulty.Hard]: HARD,
}

export function parametersFor(difficulty: Difficulty): DifficultyParameters {
  return TABLE[difficulty]
}

/**
 * Whether a value is within a difficulty's range.
 *
 * `allowNegative` is enforced here as well as the range, because a difficulty
 * with a negative `minValue` and `allowNegative: false` would otherwise admit
 * negatives through the range check alone. No such difficulty exists today; the
 * guard is here so that adding one cannot introduce the bug silently.
 */
export function valueInRange(value: number, parameters: DifficultyParameters): boolean {
  if (!parameters.allowNegative && value < 0) {
    return false
  }
  return value >= parameters.minValue && value <= parameters.maxValue
}

/** Whether a grid's dimensions match a difficulty. */
export function gridMatchesDifficulty(grid: Grid, parameters: DifficultyParameters): boolean {
  return grid.size === parameters.size
}
