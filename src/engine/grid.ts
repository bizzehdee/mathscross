/**
 * Grid construction and indexing. Plan section 2.1.
 *
 * A grid is addressed by a single flat index throughout the engine. Row and
 * column are converted at the edges only, because every hot path — masking,
 * search, equation membership — works on flat indices and converting inside
 * those loops would be pure overhead.
 */
import { CellKind, EMPTY, operatorFromAscii, type Grid } from './types'

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

/**
 * Builds a grid from a text board.
 *
 * Cells are whitespace-separated. One token per cell, and every row must hold
 * the same number of cells as there are rows, because grids are square.
 *
 * ```text
 *   #        block
 *   =        equals
 *   + - * /  operator, with that value
 *   0 .. 9   digit, with that value
 *   ?        digit cell, empty
 *   @        operator cell, empty
 * ```
 *
 * `?` and `@` are distinct because an empty digit cell and an empty operator
 * cell differ in kind, and kind is what the parser reads. A single `?` for both
 * would make a masked board ambiguous.
 */
export function gridFromText(text: string): Grid {
  const rows = text
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/))

  const size = rows.length
  const firstRow = rows[0]
  if (firstRow === undefined) {
    throw new Error('A text board needs at least one row')
  }

  for (const row of rows) {
    if (row.length !== size) {
      throw new Error(
        `A text board must be square: ${size} rows but a row of ${row.length} cells`,
      )
    }
  }

  const grid = createGrid(size)

  for (let row = 0; row < size; row += 1) {
    const cells = rows[row]
    if (cells === undefined) {
      continue
    }
    for (let column = 0; column < size; column += 1) {
      const token = cells[column]
      if (token === undefined) {
        continue
      }
      const index = row * size + column
      applyToken(grid, index, token)
    }
  }

  return grid
}

function applyToken(grid: Grid, index: number, token: string): void {
  if (token === '#') {
    grid.kinds[index] = CellKind.Block
    grid.values[index] = EMPTY
    return
  }
  if (token === '=') {
    grid.kinds[index] = CellKind.Equals
    grid.values[index] = EMPTY
    return
  }
  if (token === '?') {
    grid.kinds[index] = CellKind.Digit
    grid.values[index] = EMPTY
    return
  }
  if (token === '@') {
    grid.kinds[index] = CellKind.Operator
    grid.values[index] = EMPTY
    return
  }

  const operator = operatorFromAscii(token)
  if (operator !== null) {
    grid.kinds[index] = CellKind.Operator
    grid.values[index] = operator
    return
  }

  if (/^[0-9]$/.test(token)) {
    grid.kinds[index] = CellKind.Digit
    grid.values[index] = Number(token)
    return
  }

  throw new Error(`Unrecognised cell token: ${JSON.stringify(token)}`)
}
