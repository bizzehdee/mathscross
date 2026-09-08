/**
 * The three board layouts. Plan section 2.9.
 *
 * A board's shape is a design decision made once and looked at, not the emergent
 * property of a search. Each difficulty has one hand-drawn grid here, and the
 * equations on it are listed rather than scanned for: `layouts.test.ts` asserts the
 * list matches the picture, so a mistyped grid fails as a mistyped grid.
 *
 * What varies from board to board is the fill, the mask, and — at Medium — which
 * width triple each equation takes. Section 2.9 records what that costs and why it
 * is worth paying.
 */
import { parametersFor, type Difficulty, type DifficultyParameters } from './difficulty'
import { Operator, type Widths } from './types'

/** One equation's position on a layout: a run of digit, operator and equals cells. */
export interface LayoutEquation {
  readonly orientation: 'row' | 'column'
  /** Row index for a row equation, column index for a column equation. */
  readonly line: number
  /** Offset along that line where the equation starts. */
  readonly start: number
  readonly length: number
}

export interface Layout {
  readonly size: number
  /** One string per row. `#` is a block cell, `.` a cell an equation covers. */
  readonly rows: readonly string[]
  readonly equations: readonly LayoutEquation[]
}

const EASY: Layout = {
  size: 5,
  rows: [
    '.....',
    '.#.#.',
    '.....',
    '.#.#.',
    '.....',
  ],
  equations: [
    { orientation: 'row', line: 0, start: 0, length: 5 },
    { orientation: 'row', line: 2, start: 0, length: 5 },
    { orientation: 'row', line: 4, start: 0, length: 5 },
    { orientation: 'column', line: 0, start: 0, length: 5 },
    { orientation: 'column', line: 2, start: 0, length: 5 },
    { orientation: 'column', line: 4, start: 0, length: 5 },
  ],
}

/**
 * Easy's shape one size up, and deliberately so.
 *
 * The step from Easy is the 7-cell line, multiplication and two-digit numbers, and
 * nothing else: same equation count, same intersection count, same guarantee of a
 * guess-free route. Every one of the six equations also chooses its widths
 * independently, which is where a fixed layout gets its variety back.
 */
const MEDIUM: Layout = {
  size: 7,
  rows: [
    '.......',
    '.##.##.',
    '.##.##.',
    '.......',
    '.##.##.',
    '.##.##.',
    '.......',
  ],
  equations: [
    { orientation: 'row', line: 0, start: 0, length: 7 },
    { orientation: 'row', line: 3, start: 0, length: 7 },
    { orientation: 'row', line: 6, start: 0, length: 7 },
    { orientation: 'column', line: 0, start: 0, length: 7 },
    { orientation: 'column', line: 3, start: 0, length: 7 },
    { orientation: 'column', line: 6, start: 0, length: 7 },
  ],
}

/**
 * Fourteen equations on an 11 x 11: eight of 5 cells and six of 11.
 *
 * Columns 4 and 6 are dotted rather than continuous — free on the even rows, blocked
 * on the odd ones — so they carry no equation of their own. That is what makes the
 * board fillable, and it is the second thing this layout had to be corrected for.
 *
 * **Correction one: a 7-cell line cannot cross on even offsets.** As first drawn,
 * rows 2 and 8 and columns 0, 2, 8 and 10 stopped a cell short at each end, making
 * them 7 cells. A 7-cell equation admits only `(1, 2, 2)`, `(2, 1, 2)` and
 * `(2, 2, 1)`, whose operator and equals cells fall at offsets `{1, 4}`, `{2, 4}`
 * and `{2, 5}`, and those lines are crossed at offsets 0, 2, 4 and 6. Every triple
 * puts a non-digit at offset 2 or 4, so no width assignment exists for any seed.
 * Opening them to the full 11 cells fixed it.
 *
 * **Correction two: every equation needs a cell of its own.** With all six even
 * columns carrying equations, each 5-cell row equation had its three digits — at
 * offsets 0, 2 and 4 — pinned by three crossing columns. The fill then had nothing
 * to draw: the equation could only come out true by luck, and twelve of them had to
 * come out true at once. Hard exhausted 5000 attempts on every seed.
 *
 * The rule underneath both, and the one to check a new layout against: **on a
 * lattice whose lines sit two apart, a 5-cell equation is entirely crossings.** Its
 * digits are at offsets 0, 2 and 4, and every even offset meets a line. An 11-cell
 * equation has digits at odd offsets too, so it keeps three cells of its own. A
 * 5-cell equation can only get one by not being crossed somewhere — here, by
 * columns 4 and 6 being dotted.
 */
const HARD: Layout = {
  size: 11,
  rows: [
    '.....#.....',
    '.#.#####.#.',
    '...........',
    '.#.#####.#.',
    '.....#.....',
    '.#.#####.#.',
    '.....#.....',
    '.#.#####.#.',
    '...........',
    '.#.#####.#.',
    '.....#.....',
  ],
  equations: [
    { orientation: 'row', line: 0, start: 0, length: 5 },
    { orientation: 'row', line: 0, start: 6, length: 5 },
    { orientation: 'row', line: 2, start: 0, length: 11 },
    { orientation: 'row', line: 4, start: 0, length: 5 },
    { orientation: 'row', line: 4, start: 6, length: 5 },
    { orientation: 'row', line: 6, start: 0, length: 5 },
    { orientation: 'row', line: 6, start: 6, length: 5 },
    { orientation: 'row', line: 8, start: 0, length: 11 },
    { orientation: 'row', line: 10, start: 0, length: 5 },
    { orientation: 'row', line: 10, start: 6, length: 5 },
    { orientation: 'column', line: 0, start: 0, length: 11 },
    { orientation: 'column', line: 2, start: 0, length: 11 },
    { orientation: 'column', line: 8, start: 0, length: 11 },
    { orientation: 'column', line: 10, start: 0, length: 11 },
  ],
}

const TABLE: Readonly<Record<Difficulty, Layout>> = {
  easy: EASY,
  medium: MEDIUM,
  hard: HARD,
}

export function layoutFor(difficulty: Difficulty): Layout {
  return TABLE[difficulty]
}

/** The flat cell index of an offset along an equation's line. */
export function cellAt(equation: LayoutEquation, size: number, offset: number): number {
  const position = equation.start + offset
  return equation.orientation === 'row'
    ? equation.line * size + position
    : position * size + equation.line
}

/**
 * Whether an offset along an equation holds a digit.
 *
 * `left op right = result`, so the operator sits at `left` and the equals at
 * `left + right + 1`. Everything else is a digit.
 */
export function isDigitOffset(widths: Widths, offset: number): boolean {
  return offset !== widths.left && offset !== widths.left + widths.right + 1
}

/** Inclusive value range of a number occupying `width` cells, with no leading zero. */
export function widthRange(width: number): { readonly min: number; readonly max: number } {
  if (width <= 1) {
    return { min: 0, max: 9 }
  }
  return { min: 10 ** (width - 1), max: 10 ** width - 1 }
}

/**
 * Whether a value pair is a question whose answer can be copied. Plan section 2.7.1.
 *
 * Enforced here as well as in the fill, because a width triple every instance of
 * which is degenerate is a triple the fill can never satisfy. Leaving it out is what
 * made `(1, 3, 1)` look usable at 11 cells, on the strength of `0 * 123 = 0`.
 */
function degenerate(left: number, right: number, operator: Operator): boolean {
  switch (operator) {
    case Operator.Plus:
      return left === 0 || right === 0
    case Operator.Minus:
      return right === 0
    case Operator.Times:
      return left === 0 || right === 0 || left === 1 || right === 1
    case Operator.Divide:
      return right === 1 || left === 0
    default:
      return false
  }
}

function applyOperator(left: number, right: number, operator: Operator): number | null {
  switch (operator) {
    case Operator.Plus:
      return left + right
    case Operator.Minus:
      return left - right
    case Operator.Times:
      return left * right
    case Operator.Divide:
      return right === 0 || left % right !== 0 ? null : left / right
    default:
      return null
  }
}

/**
 * Whether some non-degenerate equation of these widths exists at this difficulty.
 *
 * Exhaustive rather than interval arithmetic, and that is the point. Intervals admit
 * `(1, 3, 1)` at Hard's operator set because `0 * 123 = 0` is in range — true, banned
 * by section 2.7.1, and the only way the triple can hold. A feasibility check that
 * ignores the degenerate rule reports a width as usable when every instance of it is
 * illegal, and the fill then fails on that equation on every seed.
 *
 * The search is bounded by the difficulty's own range, so it is at worst a million
 * pairs at three digits, and it runs once per difficulty rather than once per board.
 */
export function widthsUsable(widths: Widths, parameters: DifficultyParameters): boolean {
  const left = widthRange(widths.left)
  const right = widthRange(widths.right)
  const result = widthRange(widths.result)

  for (const operator of parameters.operators) {
    for (let a = left.min; a <= left.max; a += 1) {
      for (let b = right.min; b <= right.max; b += 1) {
        if (degenerate(a, b, operator)) {
          continue
        }
        const c = applyOperator(a, b, operator)
        if (c === null || c < result.min || c > result.max) {
          continue
        }
        if (c >= parameters.minValue && c <= parameters.maxValue && (c >= 0 || parameters.allowNegative)) {
          return true
        }
      }
    }
  }
  return false
}

/** How many digits the largest permitted value has. */
function maxWidthFor(parameters: DifficultyParameters): number {
  return String(Math.max(Math.abs(parameters.minValue), parameters.maxValue)).length
}

/**
 * Every width triple an equation of this length can take at this difficulty.
 *
 * Memoised per difficulty and length: `widthsUsable` is exhaustive, and there are
 * only ever two or three lengths on a board.
 */
const optionsCache = new Map<string, readonly Widths[]>()

export function widthOptions(length: number, difficulty: Difficulty): readonly Widths[] {
  const key = `${difficulty}:${length}`
  const held = optionsCache.get(key)
  if (held !== undefined) {
    return held
  }

  const parameters = parametersFor(difficulty)
  const maxWidth = maxWidthFor(parameters)
  const digits = length - 2
  const options: Widths[] = []

  for (let left = 1; left <= maxWidth; left += 1) {
    for (let right = 1; right <= maxWidth; right += 1) {
      const result = digits - left - right
      if (result < 1 || result > maxWidth) {
        continue
      }
      const widths = { left, right, result }
      if (widthsUsable(widths, parameters)) {
        options.push(widths)
      }
    }
  }

  optionsCache.set(key, options)
  return options
}

/** Cells two equations share, as the offset each equation sees them at. */
export interface Crossing {
  readonly first: number
  readonly firstOffset: number
  readonly second: number
  readonly secondOffset: number
}

export function crossingsOf(layout: Layout): Crossing[] {
  const seen = new Map<number, { equation: number; offset: number }>()
  const crossings: Crossing[] = []

  for (let index = 0; index < layout.equations.length; index += 1) {
    const equation = layout.equations[index]
    if (equation === undefined) {
      continue
    }
    for (let offset = 0; offset < equation.length; offset += 1) {
      const cell = cellAt(equation, layout.size, offset)
      const held = seen.get(cell)
      if (held === undefined) {
        seen.set(cell, { equation: index, offset })
        continue
      }
      crossings.push({
        first: held.equation,
        firstOffset: held.offset,
        second: index,
        secondOffset: offset,
      })
    }
  }

  return crossings
}

/**
 * Widths for every equation, or null when the layout admits none.
 *
 * Backtracking, because a choice on one equation constrains the ones it crosses.
 * `prefer` orders the options an equation may take, which is how the generator makes
 * two boards on the same layout differ: pass a seeded shuffle. Its default keeps the
 * table order, so a test gets the same answer every run.
 *
 * Null is a defect in the layout, not bad luck. Section 2.9 records the Hard layout
 * that returned it.
 */
export function assignWidths(
  layout: Layout,
  difficulty: Difficulty,
  prefer: (options: readonly Widths[]) => readonly Widths[] = (options) => options,
): readonly Widths[] | null {
  const crossings = crossingsOf(layout)
  const chosen: Widths[] = []

  const fits = (index: number, widths: Widths): boolean => {
    for (const crossing of crossings) {
      if (crossing.second === index) {
        if (!isDigitOffset(widths, crossing.secondOffset)) {
          return false
        }
        const other = chosen[crossing.first]
        if (other !== undefined && !isDigitOffset(other, crossing.firstOffset)) {
          return false
        }
      } else if (crossing.first === index && !isDigitOffset(widths, crossing.firstOffset)) {
        return false
      }
    }
    return true
  }

  const walk = (index: number): boolean => {
    if (index === layout.equations.length) {
      return true
    }
    const equation = layout.equations[index]
    if (equation === undefined) {
      return false
    }
    for (const widths of prefer(widthOptions(equation.length, difficulty))) {
      if (!fits(index, widths)) {
        continue
      }
      chosen[index] = widths
      if (walk(index + 1)) {
        return true
      }
      chosen.length = index
    }
    return false
  }

  return walk(0) ? chosen : null
}
