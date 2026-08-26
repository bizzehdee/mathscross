/**
 * Grid construction and indexing. Plan section 2.1.
 *
 * A grid is addressed by a single flat index throughout the engine. Row and
 * column are converted at the edges only, because every hot path — masking,
 * search, equation membership — works on flat indices and converting inside
 * those loops would be pure overhead.
 */
import { CellKind, EMPTY, type Grid } from './types'

export function cellIndex(size: number, row: number, column: number): number {
  return row * size + column
}

export function cellRow(size: number, index: number): number {
  return Math.floor(index / size)
}

export function cellColumn(size: number, index: number): number {
  return index % size
}

/** A grid of the given size, every cell a block, every value empty. */
export function createGrid(size: number): Grid {
  const cells = size * size
  const kinds = new Uint8Array(cells)
  const values = new Int8Array(cells)
  kinds.fill(CellKind.Block)
  values.fill(EMPTY)
  return { size, kinds, values }
}

/**
 * A copy that shares nothing with the original.
 *
 * `kinds` is copied rather than shared even though the mesh never changes it,
 * because a shared buffer would make an accidental mutation in one grid visible
 * in another, and that class of bug is expensive to find.
 */
export function cloneGrid(grid: Grid): Grid {
  return {
    size: grid.size,
    kinds: new Uint8Array(grid.kinds),
    values: new Int8Array(grid.values),
  }
}

/** A copy of the values only. Used per search branch, where kinds are fixed. */
export function cloneValues(grid: Grid): Int8Array {
  return new Int8Array(grid.values)
}

/**
 * Whether a cell holds no value.
 *
 * True for block and equals cells too, which hold `EMPTY` permanently and are
 * not waiting to be filled. Callers deciding what to assign want
 * `isAssignable` instead; this is only for asking what a cell currently holds.
 */
export function isEmpty(grid: Grid, index: number): boolean {
  return grid.values[index] === EMPTY
}

/**
 * Whether a cell is a variable waiting for a value.
 *
 * `EMPTY` is overloaded: in a digit or operator cell it means "not filled yet",
 * and in a block or equals cell it means "never applicable". Only the kind
 * distinguishes them, so any code that searches, propagates or counts blanks must
 * test the kind as well as the value.
 *
 * Getting this wrong is not subtle in its effect but is very easy to write: the
 * first draft of the solver filtered on the value alone, so every equation
 * appeared to have its equals cell as an unfilled variable, that cell had no
 * candidate values, and the solver reported a contradiction on every puzzle.
 */
export function isAssignable(grid: Grid, index: number): boolean {
  const kind = grid.kinds[index]
  if (kind !== CellKind.Digit && kind !== CellKind.Operator) {
    return false
  }
  return grid.values[index] === EMPTY
}

/** Cells of an equation, or any list, that are waiting for a value. */
export function assignableAmong(grid: Grid, cells: readonly number[]): number[] {
  return cells.filter((cell) => isAssignable(grid, cell))
}

/** Whether every non-block cell holds a value. */
export function isComplete(grid: Grid): boolean {
  for (let index = 0; index < grid.kinds.length; index += 1) {
    const kind = grid.kinds[index]
    if (kind === CellKind.Digit || kind === CellKind.Operator) {
      if (grid.values[index] === EMPTY) {
        return false
      }
    }
  }
  return true
}

/** How many cells of a kind the grid holds. */
export function countKind(grid: Grid, kind: CellKind): number {
  let total = 0
  for (let index = 0; index < grid.kinds.length; index += 1) {
    if (grid.kinds[index] === kind) {
      total += 1
    }
  }
  return total
}
