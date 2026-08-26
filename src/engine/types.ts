/**
 * The shared vocabulary of the engine. Plan section 2.1.
 *
 * Nothing here imports anything: this module is the bottom of the engine.
 */

/**
 * What a cell is. Fixed by the mesh and never changed by the player.
 *
 * A plain frozen object rather than a TypeScript `enum`, because
 * `verbatimModuleSyntax` and `isolatedModules` rule out `const enum`, and a
 * regular `enum` emits a runtime object with reverse mappings nothing needs.
 */
export const CellKind = {
  Block: 0,
  Digit: 1,
  Operator: 2,
  Equals: 3,
} as const

export type CellKind = (typeof CellKind)[keyof typeof CellKind]

/**
 * The four operators, stored as small integers.
 *
 * Stored numerically and rendered separately, so that comparison and
 * serialisation never depend on a glyph. Plan section 2.1 requires the ASCII
 * forms `+ - * /` for storage and `+ − × ÷` only for display.
 */
export const Operator = {
  Plus: 0,
  Minus: 1,
  Times: 2,
  Divide: 3,
} as const

export type Operator = (typeof Operator)[keyof typeof Operator]

export const ALL_OPERATORS: readonly Operator[] = [
  Operator.Plus,
  Operator.Minus,
  Operator.Times,
  Operator.Divide,
]

/** ASCII form, for storage, serialisation and tests. */
const OPERATOR_ASCII: Readonly<Record<Operator, string>> = {
  [Operator.Plus]: '+',
  [Operator.Minus]: '-',
  [Operator.Times]: '*',
  [Operator.Divide]: '/',
}

/** Display form. Never stored, never compared. */
const OPERATOR_GLYPH: Readonly<Record<Operator, string>> = {
  [Operator.Plus]: '+',
  [Operator.Minus]: '−',
  [Operator.Times]: '×',
  [Operator.Divide]: '÷',
}

export function operatorToAscii(operator: Operator): string {
  return OPERATOR_ASCII[operator]
}

export function operatorToGlyph(operator: Operator): string {
  return OPERATOR_GLYPH[operator]
}

/** Parses an ASCII operator, returning null rather than throwing. */
export function operatorFromAscii(text: string): Operator | null {
  switch (text) {
    case '+':
      return Operator.Plus
    case '-':
      return Operator.Minus
    case '*':
      return Operator.Times
    case '/':
      return Operator.Divide
    default:
      return null
  }
}

/**
 * The value of a cell that is masked, or that the player has not filled.
 *
 * -1 rather than 0, because 0 is a legitimate digit. Held in an `Int8Array`,
 * so the sentinel has to be in range.
 */
export const EMPTY = -1

/**
 * A grid.
 *
 * Two parallel typed arrays rather than an array of cell objects. The generator
 * clones a grid on every masking step and on every search branch, and a typed
 * array clones in one call with no per-cell allocation. `kinds` never changes
 * after the mesh is built; `values` is what search and the player mutate.
 *
 * `values` holds a digit 0 to 9 in a `Digit` cell, an `Operator` code in an
 * `Operator` cell, `EMPTY` in either when unfilled, and is unused for `Block`
 * and `Equals` cells. `kinds` disambiguates, so a digit and an operator code
 * sharing the number 1 is not a collision.
 */
export interface Grid {
  readonly size: number
  readonly kinds: Uint8Array
  readonly values: Int8Array
}
