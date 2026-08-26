/**
 * Depth-first search with forward checking. Plan section 6.
 *
 * Serves two callers in release 1: the generator's value fill, and the
 * uniqueness check the masking loop runs after every mask. A third caller,
 * hints, is deferred.
 *
 * Two properties the callers depend on:
 *
 *   - **Early exit.** The uniqueness check stops the moment it finds a second
 *     solution. Enumerating the full solution set is the difference between a
 *     check costing milliseconds and one costing seconds, and the masking loop
 *     runs this once per mask.
 *   - **Determinism.** Candidate values are tried in a fixed order and variables
 *     chosen by a fixed rule, so the same masked grid always yields the same
 *     first solution. The generator relies on this: the daily puzzle must be
 *     identical on every device.
 */
import { equationState } from './evaluate'
import { assignableAmong, cloneValues, isAssignable } from './grid'
import {
  binaryShape,
  orderEquations,
  parseGrid,
  type Equation,
  type ParsedGrid,
} from './parse'
import {
  isFullyUnknown,
  knownValue,
  solveForMissing,
  writeNumberIfConsistent,
} from './numbers'
import type { Rng } from './rng'
import { ALL_OPERATORS, CellKind, EMPTY, Operator, type Grid } from './types'

/**
 * Which deductions a solve needed. Plan section 6.3.
 *
 * Used to confirm a puzzle is solvable by deduction rather than only by brute
 * force. This is not the difficulty grade — the difficulty table sets that.
 */
export type Technique = 'direct' | 'domain' | 'search'

export interface SolveOptions {
  /** Operators the puzzle may use. Masked operator cells draw from this. */
  readonly operators?: readonly Operator[]
  /** Stop once this many solutions are found. 2 is enough for uniqueness. */
  readonly maxSolutions?: number
  /** Reuse a parse rather than repeating it. The generator parses once. */
  readonly parsed?: ParsedGrid
  /**
   * Shuffles each cell's candidate order.
   *
   * Without this, `solve` returns the lexicographically first solution, so a
   * given mesh and operator assignment always fills to the same values and every
   * puzzle from that mesh would be identical. The generator passes its seeded
   * Rng here, which keeps the fill varied *and* reproducible — both of which the
   * daily puzzle needs. Omit it for uniqueness checking, where order is
   * irrelevant and shuffling is wasted work.
   */
  readonly rng?: Rng
  /**
   * Search nodes before the solve gives up. Default .
   *
   * A uniqueness check on a heavily masked 9x9 grows exponentially with the blank
   * count: measured at M2, one check cost 1 ms at 5 blanks, 48 ms at 15 and over
   * 2000 ms at 19, against a Hard target of 29. Masking to target would take
   * minutes per puzzle.
   *
   * Exceeding the budget sets `truncated`, and `hasUniqueSolution` then answers
   * false. That is deliberately conservative: the generator refuses a mask it
   * cannot cheaply prove safe, so a shipped puzzle is never ambiguous, and the
   * cost is achieved density rather than correctness.
   */
  readonly maxNodes?: number
}

export const DEFAULT_MAX_NODES = 20_000

export interface SolveResult {
  /** Solutions found, capped at `maxSolutions`. */
  readonly count: number
  /** Values of the first solution, or null if there is none. */
  readonly first: Int8Array | null
  /** Techniques the solve needed. */
  readonly techniques: ReadonlySet<Technique>
  /** True when the grid is illegal, in which case nothing was searched. */
  readonly illegal: boolean
  /** True when the node budget ran out, so the count is a lower bound. */
  readonly truncated: boolean
}

/**
 * Whether a masked grid is *provably* uniquely solvable within the node budget.
 *
 * False when the budget ran out, even if only one solution was found. A caller
 * masking cells needs a guarantee, and "probably unique" is not one.
 */
export function hasUniqueSolution(grid: Grid, options: SolveOptions = {}): boolean {
  const result = solve(grid, { ...options, maxSolutions: 2 })
  return result.count === 1 && !result.truncated
}

/**
 * Precomputed, value-independent facts about a grid.
 *
 * Parsing depends only on cell kinds, so this survives every assignment and is
 * computed once per grid rather than once per branch.
 */
interface Compiled {
  readonly parsed: ParsedGrid
  /** Empty cells to assign, most-constrained first. */
  readonly variables: readonly number[]
  /** Candidate values for each cell index, by flat index. */
  readonly domains: readonly (readonly number[])[]
}

export function solve(grid: Grid, options: SolveOptions = {}): SolveResult {
  const parsed = options.parsed ?? parseGrid(grid)
  const maxSolutions = options.maxSolutions ?? 2
  const operators = options.operators ?? ALL_OPERATORS
  const techniques = new Set<Technique>()

  if (parsed.problems.length > 0) {
    return { count: 0, first: null, techniques, illegal: true, truncated: false }
  }

  const compiled = compile(grid, parsed, operators, options.rng)
  const values = cloneValues(grid)
  const solutions: Int8Array[] = []
  const budget = { remaining: options.maxNodes ?? DEFAULT_MAX_NODES }

  search(grid, compiled, values, solutions, maxSolutions, techniques, budget)

  return {
    count: solutions.length,
    first: solutions[0] ?? null,
    techniques,
    illegal: false,
    truncated: budget.remaining <= 0,
  }
}

function compile(
  grid: Grid,
  parsed: ParsedGrid,
  operators: readonly Operator[],
  rng?: Rng,
): Compiled {
  const domains: number[][] = Array.from({ length: grid.kinds.length }, () => [])
  const variables: number[] = []

  for (let cell = 0; cell < grid.kinds.length; cell += 1) {
    // `isAssignable`, not a bare value test: block and equals cells also hold
    // EMPTY, permanently, and must never become variables.
    if (!isAssignable(grid, cell)) {
      continue
    }
    const kind = grid.kinds[cell]

    if (kind === CellKind.Digit) {
      // A multi-cell number must not carry a leading zero, so its first cell
      // starts at 1. Plan section 2.2.
      const from = parsed.leadingDigitCells.has(cell) ? 1 : 0
      const domain: number[] = []
      for (let digit = from; digit <= 9; digit += 1) {
        domain.push(digit)
      }
      domains[cell] = domain
      variables.push(cell)
      continue
    }

    if (kind === CellKind.Operator) {
      // A sign position admits only minus: a unary plus carries no meaning.
      // Plan section 2.3.
      domains[cell] = isSignCell(parsed, cell) ? [Operator.Minus] : [...operators]
      variables.push(cell)
    }
  }

  // Shuffle candidate order when asked. Applied after every domain is built, so
  // a domain's contents are unchanged and only the order in which the search
  // tries them varies. Still fully deterministic: the Rng is seeded.
  if (rng !== undefined) {
    for (const cell of variables) {
      const domain = domains[cell]
      if (domain !== undefined) {
        rng.shuffle(domain)
      }
    }
  }

  return { parsed, variables: orderVariables(variables, parsed), domains }
}

/**
 * Orders variables equation by equation, in reading order within each.
 *
 * Not most-constrained-first, which is the usual heuristic and was the first
 * implementation. Most-constrained-first interleaves cells from different
 * equations, so no equation ever completes early and the forward check has
 * nothing to reject — a 60%-masked Medium board took 19 seconds to check for
 * uniqueness.
 *
 * Grouping by equation means every few assignments finish one, at which point the
 * equation check prunes the whole subtree and number-level propagation can derive
 * the remaining terms. Equations come in breadth-first order so each shares cells
 * with one already assigned, inheriting its fixed digits.
 *
 * Cells in no equation cannot exist in a legal grid, but are appended rather than
 * dropped so an illegal grid still terminates.
 */
function orderVariables(variables: readonly number[], parsed: ParsedGrid): number[] {
  const pending = new Set(variables)
  const ordered: number[] = []

  for (const equation of orderEquations(parsed)) {
    for (const cell of equation.cells) {
      if (pending.delete(cell)) {
        ordered.push(cell)
      }
    }
  }

  for (const cell of variables) {
    if (pending.delete(cell)) {
      ordered.push(cell)
    }
  }

  return ordered
}

function isSignCell(parsed: ParsedGrid, cell: number): boolean {
  for (const equationIndex of parsed.equationsByCell[cell] ?? []) {
    const equation = parsed.equations[equationIndex]
    if (equation === undefined) {
      continue
    }
    for (const token of equation.tokens) {
      if (token.kind === 'operator' && token.cell === cell && token.role === 'sign') {
        return true
      }
    }
  }
  return false
}

/**
 * Assigns the next unassigned variable, recursively.
 *
 * Propagation runs first: any equation with exactly one empty cell has that cell
 * determined by arithmetic, so it is filled without branching. Only when nothing
 * is forced does the search pick a variable and try its candidates.
 */
function search(
  grid: Grid,
  compiled: Compiled,
  values: Int8Array,
  solutions: Int8Array[],
  maxSolutions: number,
  techniques: Set<Technique>,
  budget: { remaining: number },
): void {
  if (solutions.length >= maxSolutions || budget.remaining <= 0) {
    return
  }
  budget.remaining -= 1

  const working = { size: grid.size, kinds: grid.kinds, values }

  const propagated = propagate(working, compiled, techniques)
  if (propagated === 'contradiction') {
    return
  }

  const next = firstEmpty(compiled, values)
  if (next === null) {
    if (allSatisfied(working, compiled.parsed.equations)) {
      solutions.push(new Int8Array(values))
    }
    return
  }

  techniques.add('search')

  for (const candidate of compiled.domains[next] ?? []) {
    const snapshot = new Int8Array(values)
    values[next] = candidate
    if (!violates(working, compiled, next)) {
      search(grid, compiled, values, solutions, maxSolutions, techniques, budget)
      if (solutions.length >= maxSolutions || budget.remaining <= 0) {
        values.set(snapshot)
        return
      }
    }
    values.set(snapshot)
  }
}

/**
 * Fills every cell that arithmetic forces, repeatedly, until nothing changes.
 *
 * An equation with one empty cell has a candidate set of the values that satisfy
 * it. One candidate means the cell is determined — logged as `direct`. Where a
 * cell sits in two such equations and the intersection of their candidate sets is
 * smaller than either, that is logged as `domain`.
 */
function propagate(
  working: Grid,
  compiled: Compiled,
  techniques: Set<Technique>,
): 'ok' | 'contradiction' {
  let changed = true

  while (changed) {
    changed = false

    // Number level first. Plan section 6.2: when two of an equation's three
    // numbers and its operator are known, compute the third and write its digits
    // rather than searching each cell.
    //
    // This is not an optimisation, it is what makes the solver usable. Cell-level
    // propagation alone only fires when an equation has a single empty *cell*,
    // which on a 60%-masked Medium board is almost never true early — so nothing
    // pruned, and a uniqueness check that should cost milliseconds took 16 seconds.
    const numeric = propagateNumbers(working, compiled, techniques)
    if (numeric === 'contradiction') {
      return 'contradiction'
    }
    if (numeric === 'changed') {
      changed = true
    }

    for (const equation of compiled.parsed.equations) {
      const empties = assignableAmong(working, equation.cells)

      if (empties.length === 0) {
        if (equationState(working, equation) !== 'satisfied') {
          return 'contradiction'
        }
        continue
      }
      if (empties.length > 1) {
        continue
      }

      const cell = empties[0]
      if (cell === undefined) {
        continue
      }

      const candidates = candidatesFor(working, compiled, cell, equation)
      if (candidates.length === 0) {
        return 'contradiction'
      }
      if (candidates.length === 1) {
        const only = candidates[0]
        if (only === undefined) {
          continue
        }
        // Fixed by a second equation as well as this one, rather than by this
        // equation alone: that is the `domain` technique rather than `direct`.
        const otherEquations = (compiled.parsed.equationsByCell[cell] ?? []).filter(
          (index) => compiled.parsed.equations[index] !== equation,
        )
        techniques.add(otherEquations.length > 0 ? 'domain' : 'direct')
        working.values[cell] = only
        changed = true
      }
    }
  }

  return 'ok'
}

/**
 * Derives whole numbers whose value follows arithmetically.
 *
 * For each `a op b = c` equation with a known operator, exactly one fully unknown
 * number and the other two fully known, computes the missing one and writes its
 * digits. A value that does not fit its cells, carries a leading zero, or
 * contradicts a digit a crossing equation fixed is a contradiction, not a skip.
 */
function propagateNumbers(
  working: Grid,
  compiled: Compiled,
  techniques: Set<Technique>,
): 'ok' | 'changed' | 'contradiction' {
  let changed = false

  for (const equation of compiled.parsed.equations) {
    const shape = binaryShape(equation)
    if (shape === null) {
      continue
    }

    const operator = working.values[shape.operatorCell]
    if (operator === undefined || operator === EMPTY) {
      continue
    }

    const terms = [shape.left, shape.right, shape.result] as const
    const unknown = terms.filter((term) => isFullyUnknown(working, term))
    if (unknown.length !== 1) {
      continue
    }
    const target = unknown[0]
    if (target === undefined) {
      continue
    }

    const values = terms.map((term) =>
      term === target ? undefined : (knownValue(working, term) ?? undefined),
    )
    // A term that is partially filled reads as unknown here, which would leave
    // two unknowns and nothing to derive. Require exactly one gap: the target.
    if (values.filter((value) => value === undefined).length !== 1) {
      continue
    }
    const [a, b, c] = values

    const derived = solveForMissing(operator as Operator, {
      ...(a === undefined ? {} : { a }),
      ...(b === undefined ? {} : { b }),
      ...(c === undefined ? {} : { c }),
    })
    if (derived === null) {
      return 'contradiction'
    }
    if (!writeNumberIfConsistent(working, target, derived)) {
      return 'contradiction'
    }

    // Derived from two other numbers in this equation, which is arithmetic rather
    // than a search: `direct`. A cell shared with another equation makes it
    // `domain`, because the crossing equation is what fixed the inputs.
    const crossed = target.cells.some(
      (cell) => (compiled.parsed.equationsByCell[cell] ?? []).length > 1,
    )
    techniques.add(crossed ? 'domain' : 'direct')
    changed = true
  }

  return changed ? 'changed' : 'ok'
}

/** Values for `cell` that leave `equation` satisfied, given everything else. */
function candidatesFor(
  working: Grid,
  compiled: Compiled,
  cell: number,
  equation: Equation,
): number[] {
  const found: number[] = []
  const original = working.values[cell] ?? EMPTY

  for (const candidate of compiled.domains[cell] ?? []) {
    working.values[cell] = candidate
    if (equationState(working, equation) === 'satisfied') {
      found.push(candidate)
    }
  }

  working.values[cell] = original
  return found
}

/**
 * Whether assigning `cell` has already broken an equation.
 *
 * The forward check. Only equations that the assignment completed can be
 * decided; a partially filled equation is `incomplete` and proves nothing.
 */
function violates(working: Grid, compiled: Compiled, cell: number): boolean {
  for (const index of compiled.parsed.equationsByCell[cell] ?? []) {
    const equation = compiled.parsed.equations[index]
    if (equation === undefined) {
      continue
    }
    if (equationState(working, equation) === 'unsatisfied') {
      return true
    }
  }
  return false
}

function firstEmpty(compiled: Compiled, values: Int8Array): number | null {
  for (const cell of compiled.variables) {
    if (values[cell] === EMPTY) {
      return cell
    }
  }
  return null
}

function allSatisfied(working: Grid, equations: readonly Equation[]): boolean {
  for (const equation of equations) {
    if (equationState(working, equation) !== 'satisfied') {
      return false
    }
  }
  return true
}
