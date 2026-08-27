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
  Extreme: 'extreme',
} as const

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty]

export const ALL_DIFFICULTIES: readonly Difficulty[] = [
  Difficulty.Easy,
  Difficulty.Medium,
  Difficulty.Hard,
  Difficulty.Extreme,
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
  /**
   * Whether every puzzle must be solvable by deduction alone.
   *
   * When true, a masked candidate is rejected unless constraint propagation
   * finishes it without ever branching — so there is a chain of forced steps from
   * the givens to the answer, and no point at which a player has to try a value to
   * see whether it works.
   *
   * The two techniques propagation uses are both ones a child can do: an equation
   * with one blank determines that blank, and a cell where two equations cross
   * takes only the values both allow. So this is a conservative guarantee rather
   * than an exact one — a puzzle it rejects might still be deducible by a person
   * reasoning about magnitudes or parity, which the engine cannot. Conservative is
   * the right direction for the grades children play.
   *
   * Measured before this existed: Easy was already 30 out of 30 deducible, and
   * **Medium was 0 out of 30**. Every Medium board required guessing, which is why
   * the step up from Easy did not feel like a step.
   */
  readonly requireDeducible: boolean
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
  requireDeducible: true,
}

/**
 * The rung that was missing.
 *
 * Easy to the old Medium changed seven things at once — grid size, equation
 * length, a third operator, two-digit numbers, negatives, more intersections and
 * hidden operators — and the two hardest of those arrived together. A player
 * described the result as a huge jump, and the measurement agreed: Easy was wholly
 * deducible and the old Medium was not deducible at all.
 *
 * This grade takes three of those steps and leaves the other four to Hard. It
 * introduces the 7x7 grid, multi-cell numbers and multiplication. It keeps every
 * operator on show and every value positive, and it must be deducible.
 */
const MEDIUM: DifficultyParameters = {
  size: 7,
  minEquationLength: 5,
  maxEquationLength: 7,
  operators: [Operator.Plus, Operator.Minus, Operator.Times],
  // Positive only. A negative intermediate value is the single largest step in
  // difficulty for this age group, and it is Hard's to introduce.
  minValue: 0,
  maxValue: 99,
  minIntersections: 5,
  maxIntersections: 8,
  allowNegative: false,
  // Lower than Hard's, and lower than the old Medium's 0.5. Deducibility is what
  // sets this: every cell masked is a cell propagation has to reach, and the
  // measured achievable figure is in the milestone notes.
  digitMaskRatio: 0.35,
  // Every operator shown. Deducing which operator a cell holds is a different
  // kind of reasoning from arithmetic, and one a player should meet only after the
  // arithmetic is comfortable.
  operatorMaskRatio: 0,
  requireDeducible: true,
}

/**
 * The old Medium, unchanged, one rung further up the scale.
 *
 * This is where negatives and hidden operators arrive, and where guessing becomes
 * legitimate: the puzzle is guaranteed to have exactly one answer, but not
 * guaranteed to be reachable without trying something.
 */
const HARD: DifficultyParameters = {
  size: 7,
  minEquationLength: 5,
  maxEquationLength: 7,
  operators: [Operator.Plus, Operator.Minus, Operator.Times],
  minValue: -99,
  maxValue: 99,
  minIntersections: 5,
  maxIntersections: 8,
  allowNegative: true,
  // 0.50, not the 0.60 the plan first specified. M0.5 predicted this from a
  // hand-built board that could only reach 0.42, and M2 measured 0.53 achieved
  // against a 0.60 target across 60 seeds. Set to what uniqueness allows.
  digitMaskRatio: 0.5,
  operatorMaskRatio: 0.3,
  requireDeducible: false,
}

/**
 * The old Hard, unchanged, renamed.
 *
 * Named for what it is. Every operator hidden on a 9x9 with division and
 * three-digit values is not the top of a scale a child is climbing; it is a
 * different game, and calling it Hard made the grade below it look mild.
 */
const EXTREME: DifficultyParameters = {
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
  // 0.45, not the 0.75 the plan first specified. Measured at M2: 0.75 is not
  // reachable at any acceptable cost. A uniqueness check on a 9x9 grows
  // exponentially with the blank count — 1 ms at 5 blanks, 48 ms at 15, over
  // 2000 ms at 19 — so masking to 29 of 39 digit cells takes minutes per puzzle.
  // Achieved is 0.46, so this target is met rather than merely approached.
  //
  // Raising it needs a stronger solver, not a bigger budget: bounds propagation
  // over partially known numbers would prune where the current forward check
  // cannot. Recorded in .learnings/generation-measurements.md as the way back.
  digitMaskRatio: 0.45,
  // 100% operator masking, and it holds. M0.5 doubted this and the plan demoted it
  // to a hypothesis; M2 measured it reached in full, but only once operators were
  // masked *before* digits. With digits first it reached 14%. See mask.ts rule 1.
  operatorMaskRatio: 1,
  requireDeducible: false,
}

const TABLE: Readonly<Record<Difficulty, DifficultyParameters>> = {
  [Difficulty.Easy]: EASY,
  [Difficulty.Medium]: MEDIUM,
  [Difficulty.Hard]: HARD,
  [Difficulty.Extreme]: EXTREME,
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
