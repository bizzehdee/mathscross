/**
 * Boards for tests, and a text format for writing them.
 *
 * Not a test file: the generator's own tests and the slow suite build grids the
 * same way, and a shared builder keeps a board in a test readable as a board.
 */
import { createGrid } from './grid'
import { CellKind, EMPTY, operatorFromAscii, type Grid } from './types'

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

/**
 * The reference board from plan section 2.8.
 *
 * A valid Easy 5x5 in which every digit cell is shared by two equations, which
 * exercises maximum intersection density. Its nine intersections deliberately
 * exceed the Easy range: it is a parsing and evaluation fixture, not a
 * difficulty-conformant puzzle.
 *
 * Six equations, all satisfied:
 *   rows     1 + 2 = 3    2 + 1 = 3    3 + 3 = 6
 *   columns  1 + 2 = 3    2 + 1 = 3    3 + 3 = 6
 *
 * Note that rows 0 and 2 are separated by a row carrying operator cells rather
 * than blocks. That is legal under the plan's spacing rule, and would not have
 * been under an earlier draft of it — which is why this board is the fixture.
 */
export const REFERENCE_BOARD = `
  1 + 2 = 3
  + # + # +
  2 + 1 = 3
  = # = # =
  3 + 3 = 6
`

export function referenceGrid(): Grid {
  return gridFromText(REFERENCE_BOARD)
}

/**
 * A single seven-cell row equation, for number and precedence tests.
 *
 * Padded with blocks so the only equation is the first row.
 */
export function singleRowGrid(cells: string): Grid {
  const tokens = cells.trim().split(/\s+/)
  const size = tokens.length
  const blocks = Array.from({ length: size }, () => '#').join(' ')
  const rows = [tokens.join(' ')]
  for (let row = 1; row < size; row += 1) {
    rows.push(blocks)
  }
  return gridFromText(rows.join('\n'))
}
