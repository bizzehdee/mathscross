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
import { parseGrid, type Equation, type ParsedGrid } from './parse'
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
}

export interface SolveResult {
  /** Solutions found, capped at `maxSolutions`. */
  readonly count: number
  /** Values of the first solution, or null if there is none. */
  readonly first: Int8Array | null
  /** Techniques the solve needed. */
  readonly techniques: ReadonlySet<Technique>
  /** True when the grid is illegal, in which case nothing was searched. */
  readonly illegal: boolean
}

/** Whether a masked grid has exactly one solution. */
export function hasUniqueSolution(grid: Grid, options: SolveOptions = {}): boolean {
  return solve(grid, { ...options, maxSolutions: 2 }).count === 1
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
    return { count: 0, first: null, techniques, illegal: true }
  }

  const compiled = compile(grid, parsed, operators)
  const values = cloneValues(grid)
  const solutions: Int8Array[] = []

  search(grid, compiled, values, solutions, maxSolutions, techniques)

  return {
    count: solutions.length,
    first: solutions[0] ?? null,
    techniques,
    illegal: false,
  }
}

function compile(grid: Grid, parsed: ParsedGrid, operators: readonly Operator[]): Compiled {
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

  // Most-constrained first, then by how many equations the cell sits in, then by
  // index. The last term is what makes the order deterministic when the first two
  // tie, which they often do.
  variables.sort((a, b) => {
    const sizeDifference = (domains[a]?.length ?? 0) - (domains[b]?.length ?? 0)
    if (sizeDifference !== 0) {
      return sizeDifference
    }
    const equationDifference =
      (parsed.equationsByCell[b]?.length ?? 0) - (parsed.equationsByCell[a]?.length ?? 0)
    if (equationDifference !== 0) {
      return equationDifference
    }
    return a - b
  })

  return { parsed, variables, domains }
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
): void {
  if (solutions.length >= maxSolutions) {
    return
  }

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
      search(grid, compiled, values, solutions, maxSolutions, techniques)
      if (solutions.length >= maxSolutions) {
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
