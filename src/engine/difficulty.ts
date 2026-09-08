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

/**
 * Whether an arbitrary string names a difficulty.
 *
 * Storage is the reason this exists. A board or a stats record written by an
 * earlier version can name a grade that no longer exists — `extreme` is the first
 * — and a read that casts the string through would hand the rest of the app a
 * difficulty with no parameters behind it.
 */
export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (ALL_DIFFICULTIES as readonly string[]).includes(value)
}

export interface DifficultyParameters {
  /**
   * Grid side length. Grids are always square.
   *
   * Read off the layout in `layouts.ts` rather than chosen: the picture is the
   * authority and `layouts.test.ts` asserts the two agree. Plan section 2.9.
   */
  readonly size: number
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
  /**
   * Whether an operand or result may be negative.
   *
   * Inert, at every difficulty. No layout places a sign cell, so no result can be
   * written negative, and an equation is exactly `A op B = C` with one operator, so
   * there is no intermediate to be negative either. Kept because the parser,
   * evaluator and solver all handle sign cells already and a layout may declare one
   * later. Plan sections 2.9 and 17.
   */
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
  operators: [Operator.Plus, Operator.Minus],
  minValue: 0,
  maxValue: 9,
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
  operators: [Operator.Plus, Operator.Minus, Operator.Times],
  minValue: 0,
  maxValue: 99,
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
  size: 11,
  operators: [Operator.Plus, Operator.Minus, Operator.Times],
  // Three digits, because the layout carries 11-cell lines and `ddd op ddd = ddd`
  // is the only shape one admits. Derived from the picture, not chosen.
  minValue: -999,
  maxValue: 999,
  allowNegative: true,
  // Measured on the old 7 x 7 Hard, which had seven equations. The new one has 14
  // equations and 24 intersections, and neither figure carries over: an
  // intersection cell is harder to mask and a three-digit number is three
  // variables. TASK-005 re-measures both and resets them.
  digitMaskRatio: 0.5,
  operatorMaskRatio: 0.3,
  requireDeducible: false,
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
