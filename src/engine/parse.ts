/**
 * Turning a grid into equations. Plan sections 2.2, 2.3 and 2.4.
 *
 * Parsing is purely structural: it depends on cell *kinds* and never on cell
 * values, so a fully masked grid parses to exactly the same equations as its
 * solution. That is what lets the solver compute the structure once and reuse it
 * across every branch.
 */
import { cellIndex, cellRow, cellColumn } from './grid'
import { CellKind, type Grid } from './types'

export type Orientation = 'row' | 'column'

/** A number: one or more adjacent digit cells, read in equation order. */
export interface NumberToken {
  readonly kind: 'number'
  readonly cells: readonly number[]
}

/**
 * An operator, classified by position.
 *
 * `sign` when the cell directly follows an equals cell or another operator cell,
 * `binary` everywhere else. Plan section 2.3. A `sign` admits only minus: a
 * unary plus carries no meaning.
 */
export interface OperatorToken {
  readonly kind: 'operator'
  readonly cell: number
  readonly role: 'binary' | 'sign'
}

export interface EqualsToken {
  readonly kind: 'equals'
  readonly cell: number
}

export type Token = NumberToken | OperatorToken | EqualsToken

export interface Equation {
  readonly orientation: Orientation
  /** Row index for a row equation, column index for a column equation. */
  readonly line: number
  /** Every cell in the equation, in reading order. */
  readonly cells: readonly number[]
  readonly tokens: readonly Token[]
}

export type GridProblem =
  /**
   * A non-block cell that no equation covers.
   *
   * This is the operative legality rule, not "a run of length one is illegal".
   * A single cell forming a length-one run in one direction is legal whenever a
   * perpendicular equation covers it, which is ordinary crossword construction
   * and is unavoidable at Easy: every Easy equation is exactly 5 cells, so in a
   * 5x5 grid every equation is a complete row or column, and any such layout
   * leaves length-one runs in the rows its columns pass through. Forbidding them
   * would make every 5x5 grid unbuildable. Plan section 2.4.
   */
  | { readonly kind: 'cell-in-no-equation'; readonly cell: number }
  /** An equation with no operator. A bare identity teaches the player nothing. */
  | { readonly kind: 'equation-without-operator'; readonly cells: readonly number[] }
  /**
   * An equation with anything other than exactly one equals cell.
   *
   * Plan section 2.4 defines an equation as a run containing *at least* one
   * equals. Two equals cells in one run would be a chain such as `1+2=3=3`,
   * which has no defined meaning here, so it is rejected rather than guessed at.
   */
  | {
      readonly kind: 'equation-needs-one-equals'
      readonly cells: readonly number[]
      readonly equalsCount: number
    }
  /** A token sequence that is not `side = side`. */
  | { readonly kind: 'malformed-equation'; readonly cells: readonly number[]; readonly reason: string }

export interface ParsedGrid {
  readonly equations: readonly Equation[]
  readonly problems: readonly GridProblem[]
  /** Equations covering each cell, by flat index. Empty for block cells. */
  readonly equationsByCell: readonly (readonly number[])[]
  /**
   * Digit cells that begin a number of more than one cell.
   *
   * The solver narrows these to 1 to 9: a multi-cell number must not carry a
   * leading zero. Plan section 2.2.
   */
  readonly leadingDigitCells: ReadonlySet<number>
}

export function isLegal(parsed: ParsedGrid): boolean {
  return parsed.problems.length === 0
}

/**
 * Extracts every equation from a grid, and every reason it is illegal.
 *
 * Returns problems rather than throwing. An illegal grid is a normal outcome
 * during generation — the mesh proposes and this disposes — so a caller in a
 * search loop must not pay for exception handling.
 */
export function parseGrid(grid: Grid): ParsedGrid {
  const equations: Equation[] = []
  const problems: GridProblem[] = []

  for (let row = 0; row < grid.size; row += 1) {
    collectLine(grid, 'row', row, equations, problems)
  }
  for (let column = 0; column < grid.size; column += 1) {
    collectLine(grid, 'column', column, equations, problems)
  }

  const equationsByCell: number[][] = Array.from({ length: grid.kinds.length }, () => [])
  for (let index = 0; index < equations.length; index += 1) {
    const equation = equations[index]
    if (equation === undefined) {
      continue
    }
    for (const cell of equation.cells) {
      equationsByCell[cell]?.push(index)
    }
  }

  for (let cell = 0; cell < grid.kinds.length; cell += 1) {
    if (grid.kinds[cell] === CellKind.Block) {
      continue
    }
    if ((equationsByCell[cell] ?? []).length === 0) {
      problems.push({ kind: 'cell-in-no-equation', cell })
    }
  }

  const leadingDigitCells = new Set<number>()
  for (const equation of equations) {
    for (const token of equation.tokens) {
      if (token.kind === 'number' && token.cells.length > 1) {
        const first = token.cells[0]
        if (first !== undefined) {
          leadingDigitCells.add(first)
        }
      }
    }
  }

  return { equations, problems, equationsByCell, leadingDigitCells }
}

/**
 * Splits one row or column into maximal runs of non-block cells, and turns each
 * run containing an equals cell into an equation.
 *
 * A run with no equals cell is not an equation and is not reported here. Whether
 * its cells are legal is decided by the `cell-in-no-equation` sweep in
 * `parseGrid`, which is the rule that actually governs. A run of `1 + 2` with no
 * equals is illegal only because nothing else covers those three cells.
 */
function collectLine(
  grid: Grid,
  orientation: Orientation,
  line: number,
  equations: Equation[],
  problems: GridProblem[],
): void {
  let run: number[] = []

  const flush = (): void => {
    if (run.length > 0) {
      considerRun(grid, orientation, line, run, equations, problems)
      run = []
    }
  }

  for (let offset = 0; offset < grid.size; offset += 1) {
    const cell =
      orientation === 'row' ? cellIndex(grid.size, line, offset) : cellIndex(grid.size, offset, line)

    if (grid.kinds[cell] === CellKind.Block) {
      flush()
      continue
    }
    run.push(cell)
  }
  flush()
}

function considerRun(
  grid: Grid,
  orientation: Orientation,
  line: number,
  cells: number[],
  equations: Equation[],
  problems: GridProblem[],
): void {
  let equalsCount = 0
  let operatorCount = 0
  let digitCount = 0
  for (const cell of cells) {
    const kind = grid.kinds[cell]
    if (kind === CellKind.Equals) {
      equalsCount += 1
    } else if (kind === CellKind.Operator) {
      operatorCount += 1
    } else if (kind === CellKind.Digit) {
      digitCount += 1
    }
  }

  // An equation needs an equals cell *and* at least one operand. Requiring only
  // the equals, as an earlier draft of plan section 2.4 did, treats a run that is
  // a lone equals cell as an equation with no operator — and the reference board
  // has three of them, because its column 3 reads `=`, block, `=`, block, `=`.
  // Such a run is structural: those cells belong to the perpendicular row
  // equations, and the run itself is not an equation at all.
  if (equalsCount === 0 || digitCount === 0) {
    return
  }

  const frozen = cells.slice()

  if (equalsCount !== 1) {
    problems.push({ kind: 'equation-needs-one-equals', cells: frozen, equalsCount })
    return
  }
  if (operatorCount === 0) {
    problems.push({ kind: 'equation-without-operator', cells: frozen })
    return
  }

  const tokens = tokenise(grid, frozen)
  const malformed = describeMalformation(tokens)
  if (malformed !== null) {
    problems.push({ kind: 'malformed-equation', cells: frozen, reason: malformed })
    return
  }

  equations.push({ orientation, line, cells: frozen, tokens })
}

/**
 * Groups a run's cells into number, operator and equals tokens.
 *
 * A number is a maximal run of adjacent digit cells, so `[1][5]` is fifteen
 * rather than one and five. Plan section 2.2.
 */
function tokenise(grid: Grid, cells: readonly number[]): Token[] {
  const tokens: Token[] = []
  let digits: number[] = []

  const flushDigits = (): void => {
    if (digits.length > 0) {
      tokens.push({ kind: 'number', cells: digits })
      digits = []
    }
  }

  for (const cell of cells) {
    const kind = grid.kinds[cell]

    if (kind === CellKind.Digit) {
      digits.push(cell)
      continue
    }

    flushDigits()

    if (kind === CellKind.Equals) {
      tokens.push({ kind: 'equals', cell })
      continue
    }

    // A minus directly after an equals or another operator is a sign, not a
    // subtraction. Anywhere else — including the very start of an equation — it
    // is binary, which is what makes a leading operator malformed rather than a
    // negative first operand. Plan section 2.3.
    const previous = tokens[tokens.length - 1]
    const role =
      previous !== undefined && (previous.kind === 'equals' || previous.kind === 'operator')
        ? 'sign'
        : 'binary'
    tokens.push({ kind: 'operator', cell, role })
  }

  flushDigits()
  return tokens
}

/**
 * Checks a token sequence is `side = side`, where a side is
 * `[sign] number ( binary [sign] number )*`.
 *
 * Returns a reason, or null when well formed.
 */
function describeMalformation(tokens: readonly Token[]): string | null {
  const equalsAt = tokens.findIndex((token) => token.kind === 'equals')
  if (equalsAt === -1) {
    return 'no equals token'
  }

  const left = tokens.slice(0, equalsAt)
  const right = tokens.slice(equalsAt + 1)

  const leftProblem = describeSide(left)
  if (leftProblem !== null) {
    return `left side: ${leftProblem}`
  }
  const rightProblem = describeSide(right)
  if (rightProblem !== null) {
    return `right side: ${rightProblem}`
  }
  return null
}

function describeSide(tokens: readonly Token[]): string | null {
  if (tokens.length === 0) {
    return 'empty'
  }

  let position = 0

  // A leading sign is permitted, so `= -3` reads as negative three.
  if (tokens[0]?.kind === 'operator' && (tokens[0] as OperatorToken).role === 'sign') {
    position = 1
  }

  if (tokens[position]?.kind !== 'number') {
    return 'expected a number'
  }
  position += 1

  while (position < tokens.length) {
    const operator = tokens[position]
    if (operator?.kind !== 'operator' || operator.role !== 'binary') {
      return 'expected a binary operator'
    }
    position += 1

    if (tokens[position]?.kind === 'operator' && (tokens[position] as OperatorToken).role === 'sign') {
      position += 1
    }

    if (tokens[position]?.kind !== 'number') {
      return 'expected a number after an operator'
    }
    position += 1
  }

  return null
}

/** Human-readable cell reference, for test failures and debugging. */
export function describeCell(size: number, index: number): string {
  return `r${cellRow(size, index)}c${cellColumn(size, index)}`
}

/** The three numbers and the operator of an `a op b = c` equation. */
export interface BinaryShape {
  readonly left: NumberToken
  readonly right: NumberToken
  readonly result: NumberToken
  readonly operatorCell: number
}

/**
 * Reads an equation as `a op b = c`, or null for any other shape.
 *
 * The only shape the mesh builds, and the only one the fill and the solver's
 * number-level propagation know how to reason about. Returning null rather than
 * throwing means an equation with two operators — which a future mesh could
 * produce — simply falls back to cell-level search instead of breaking.
 */
export function binaryShape(equation: Equation): BinaryShape | null {
  const tokens = equation.tokens
  if (tokens.length !== 5) {
    return null
  }
  const [left, operator, right, equals, result] = tokens
  if (
    left?.kind !== 'number' ||
    operator?.kind !== 'operator' ||
    operator.role !== 'binary' ||
    right?.kind !== 'number' ||
    equals?.kind !== 'equals' ||
    result?.kind !== 'number'
  ) {
    return null
  }
  return { left, right, result, operatorCell: operator.cell }
}

/**
 * Equations ordered so each shares a cell with one already processed.
 *
 * Filling a disconnected equation first wastes the constraint: the point of an
 * intersection is that the crossing equation inherits fixed digits. Breadth-first
 * from the first equation gives that, and the mesh guarantees a single connected
 * component so every equation is reached.
 */
export function orderEquations(parsed: ParsedGrid): Equation[] {
  const { equations } = parsed
  if (equations.length === 0) {
    return []
  }

  const ordered: Equation[] = []
  const taken = new Set<number>()
  const queue: number[] = [0]
  taken.add(0)

  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined) {
      continue
    }
    const equation = equations[index]
    if (equation === undefined) {
      continue
    }
    ordered.push(equation)

    for (const cell of equation.cells) {
      for (const neighbour of parsed.equationsByCell[cell] ?? []) {
        if (!taken.has(neighbour)) {
          taken.add(neighbour)
          queue.push(neighbour)
        }
      }
    }
  }

  // A mesh is connected, so this should not trigger. Kept so a future mesh that
  // is not connected fills what it can rather than silently dropping equations.
  for (let index = 0; index < equations.length; index += 1) {
    if (!taken.has(index)) {
      const equation = equations[index]
      if (equation !== undefined) {
        ordered.push(equation)
      }
    }
  }

  return ordered
}
