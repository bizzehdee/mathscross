/**
 * Boards for tests, and a text format for writing them.
 *
 * Not a test file: the generator's own tests and the slow suite build grids the
 * same way, and a shared builder keeps a board in a test readable as a board.
 */
import { gridFromText } from './grid'
import type { Grid } from './types'


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
