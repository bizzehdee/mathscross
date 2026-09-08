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
import { equationState, evaluateSideValue, lastSideOk } from './evaluate'
import { cloneValues, isAssignable } from './grid'
import {
  binaryShape,
  orderEquations,
  parseGrid,
  type BinaryShape,
  type Equation,
  type NumberToken,
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
  /**
   * Each equation's `a op b = c` shape, or null where it has none.
   *
   * Structural, like everything else here. `propagateNumbers` used to derive it
   * per equation per propagation pass, which came to 9.9 million calls on a Hard
   * board.
   */
  readonly shapes: readonly (BinaryShape | null)[]
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

  search(grid, compiled, values, solutions, maxSolutions, techniques, budget, null, 0, [])

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

  return {
    parsed,
    variables: orderVariables(variables, parsed),
    domains,
    shapes: parsed.equations.map((equation) => binaryShape(equation)),
  }
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
  dirty: readonly number[] | null,
  depth: number,
  snapshots: Int8Array[],
): void {
  if (solutions.length >= maxSolutions || budget.remaining <= 0) {
    return
  }
  budget.remaining -= 1

  const working = { size: grid.size, kinds: grid.kinds, values }

  const propagated = propagate(working, compiled, techniques, dirty)
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

  // One buffer per depth, reused across candidates and across nodes at that
  // depth. A fresh `Int8Array` per candidate was millions of allocations a board,
  // and the recursion is bounded by the variable count.
  let snapshot = snapshots[depth]
  if (snapshot === undefined) {
    snapshot = new Int8Array(values.length)
    snapshots[depth] = snapshot
  }
  snapshot.set(values)

  // Only the equations holding the assigned cell can have changed, so that is
  // what the child propagates from.
  const affected = compiled.parsed.equationsByCell[next] ?? []

  for (const candidate of compiled.domains[next] ?? []) {
    values[next] = candidate
    if (!violates(working, compiled, next)) {
      search(
        grid,
        compiled,
        values,
        solutions,
        maxSolutions,
        techniques,
        budget,
        affected,
        depth + 1,
        snapshots,
      )
      if (solutions.length >= maxSolutions || budget.remaining <= 0) {
        values.set(snapshot)
        return
      }
    }
    values.set(snapshot)
  }
}

/**
 * Fills every cell that arithmetic forces, until nothing changes.
 *
 * Two rules, applied to an equation until it yields nothing more:
 *
 *   - **Numbers.** With the operator and two of the three numbers known, the third
 *     follows. Not an optimisation but the thing that makes the solver usable:
 *     cell-level propagation alone only fires when an equation has a single empty
 *     *cell*, which on a heavily masked board is almost never true early, so
 *     nothing pruned and a uniqueness check took 16 seconds.
 *   - **Cells.** An equation with one empty cell has a candidate set of the values
 *     that satisfy it. One candidate means that cell is determined.
 *
 * **Only equations a change touched are revisited.** `dirty` seeds the work list
 * with the equations holding the cell the caller just assigned, and writing a cell
 * puts its equations back on the list; passing null means every equation, which is
 * what a fresh solve wants. The old version walked all of them on every pass, and
 * one assignment touches at most two — about 55% of the whole solver's time went on
 * re-deriving equations that had not changed. Propagation only ever adds
 * information, so the fixed point does not depend on the order rules are applied
 * in, and this reaches the same one.
 */
function propagate(
  working: Grid,
  compiled: Compiled,
  techniques: Set<Technique>,
  dirty: readonly number[] | null,
): 'ok' | 'contradiction' {
  const equations = compiled.parsed.equations
  const queued = new Uint8Array(equations.length)
  const queue: number[] = []

  const enqueue = (index: number): void => {
    if (queued[index] === 1) {
      return
    }
    queued[index] = 1
    queue.push(index)
  }

  if (dirty === null) {
    for (let index = 0; index < equations.length; index += 1) {
      enqueue(index)
    }
  } else {
    for (const index of dirty) {
      enqueue(index)
    }
  }

  /** Puts every equation holding this cell back on the list. */
  const touched = (cell: number): void => {
    for (const index of compiled.parsed.equationsByCell[cell] ?? []) {
      enqueue(index)
    }
  }

  while (queue.length > 0) {
    const index = queue.pop() as number
    queued[index] = 0
    const equation = equations[index]
    if (equation === undefined) {
      continue
    }

    const numeric = propagateNumbers(working, compiled, index, techniques, touched)
    if (numeric === 'contradiction') {
      return 'contradiction'
    }

    // Cell level. One empty cell is the only case worth deriving; two or more
    // leaves nothing forced, and none means the equation is decidable now.
    let empty = -1
    let empties = 0
    for (const cell of equation.cells) {
      // `isAssignable` inlined: block and equals cells hold EMPTY permanently, so
      // the kind test is what separates them from a cell waiting to be filled.
      if (working.values[cell] !== EMPTY) {
        continue
      }
      const kind = working.kinds[cell]
      if (kind !== CellKind.Digit && kind !== CellKind.Operator) {
        continue
      }
      empties += 1
      if (empties > 1) {
        break
      }
      empty = cell
    }

    if (empties === 0) {
      if (equationState(working, equation) !== 'satisfied') {
        return 'contradiction'
      }
      continue
    }
    if (empties > 1) {
      continue
    }

    const only = onlyCandidate(working, compiled, empty, equation)
    if (only === 'none') {
      return 'contradiction'
    }
    if (only === 'many') {
      continue
    }

    // Fixed by a second equation as well as this one, rather than by this
    // equation alone: that is the `domain` technique rather than `direct`.
    const crossing = compiled.parsed.equationsByCell[empty] ?? []
    techniques.add(crossing.length > 1 ? 'domain' : 'direct')
    working.values[empty] = only
    touched(empty)
  }

  return 'ok'
}

/**
 * The single value that satisfies an equation at its one empty cell.
 *
 * `'none'` is a contradiction and `'many'` means nothing is forced. Stops at the
 * second candidate: the caller only ever distinguishes none, one and more.
 *
 * Only the side holding the cell is re-evaluated. The other side cannot change —
 * this is the equation's only empty cell — so it is evaluated once and compared
 * against, which halves the arithmetic in the solver's hottest loop. A fixed side
 * that cannot be read at all is a contradiction: no candidate can satisfy an
 * equation whose other half is already invalid.
 */
function onlyCandidate(
  working: Grid,
  compiled: Compiled,
  cell: number,
  equation: Equation,
): number | 'none' | 'many' {
  const onLeft = equation.cells.indexOf(cell) < equation.leftCellCount
  const fixedTokens = onLeft ? equation.rightTokens : equation.leftTokens
  const openTokens = onLeft ? equation.leftTokens : equation.rightTokens

  const fixed = evaluateSideValue(working, fixedTokens)
  if (!lastSideOk()) {
    return 'none'
  }

  const original = working.values[cell] ?? EMPTY
  let found: number | null = null

  for (const candidate of compiled.domains[cell] ?? []) {
    working.values[cell] = candidate
    if (evaluateSideValue(working, openTokens) !== fixed || !lastSideOk()) {
      continue
    }
    if (found !== null) {
      working.values[cell] = original
      return 'many'
    }
    found = candidate
  }

  working.values[cell] = original
  return found ?? 'none'
}

/**
 * Derives one equation's missing number, where its value follows arithmetically.
 *
 * With a known operator, exactly one fully unknown number and the other two fully
 * known, the third follows. A value that does not fit its cells, carries a leading
 * zero, or contradicts a digit a crossing equation fixed is a contradiction, not a
 * skip.
 *
 * Takes one equation rather than sweeping all of them: `propagate` decides which
 * are worth revisiting. `touched` is called with each cell written, so the
 * equations crossing it come back onto the work list.
 */
function propagateNumbers(
  working: Grid,
  compiled: Compiled,
  index: number,
  techniques: Set<Technique>,
  touched: (cell: number) => void,
): 'ok' | 'changed' | 'contradiction' {
  const shape = compiled.shapes[index]
  if (shape === null || shape === undefined) {
    return 'ok'
  }

  const operator = working.values[shape.operatorCell]
  if (operator === undefined || operator === EMPTY) {
    return 'ok'
  }

  // Exactly one fully unknown term, and the other two fully known. A partially
  // filled term is neither, and leaves nothing to derive.
  let target: NumberToken | null = null
  const known: { a?: number; b?: number; c?: number } = {}
  const names = ['a', 'b', 'c'] as const
  const terms = [shape.left, shape.right, shape.result] as const

  for (let position = 0; position < terms.length; position += 1) {
    const term = terms[position] as NumberToken
    if (isFullyUnknown(working, term)) {
      if (target !== null) {
        return 'ok'
      }
      target = term
      continue
    }
    const value = knownValue(working, term)
    if (value === null) {
      return 'ok'
    }
    known[names[position] as 'a' | 'b' | 'c'] = value
  }

  if (target === null) {
    return 'ok'
  }

  const derived = solveForMissing(operator as Operator, known)
  if (derived === null) {
    return 'contradiction'
  }
  if (!writeNumberIfConsistent(working, target, derived)) {
    return 'contradiction'
  }

  // Derived from two other numbers in this equation, which is arithmetic rather
  // than a search: `direct`. A cell shared with another equation makes it
  // `domain`, because the crossing equation is what fixed the inputs.
  let crossed = false
  for (const cell of target.cells) {
    if ((compiled.parsed.equationsByCell[cell] ?? []).length > 1) {
      crossed = true
    }
    touched(cell)
  }
  techniques.add(crossed ? 'domain' : 'direct')

  return 'changed'
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
