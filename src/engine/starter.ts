/**
 * The board a brand-new player sees first. Plan section 5.8.
 *
 * On a fresh install nothing is cached, so without this the first thing a new
 * player experiences is a wait of unknown length — at exactly the moment they are
 * deciding whether to keep the app. Generation for Easy is 3 ms at worst, so this
 * matters far less than it would at Hard, but the first board is the one worth
 * being certain about, and a bundled board costs tens of bytes.
 *
 * Produced by the real generator, from Easy seed 1, and verified by the same
 * property tests every generated puzzle faces. It is data, not a special case:
 * the game treats it as an ordinary puzzle once loaded.
 *
 * Regenerating: run the generator for Easy seed 1 and paste the board. Anything
 * that changes what a seed produces will make this board no longer match seed 1,
 * which is harmless — nothing checks that it does — but the tests still assert it
 * is a valid, uniquely solvable Easy puzzle.
 */
import { Difficulty } from './difficulty'
import { gridFromText } from './grid'
import type { Grid } from './types'

/**
 * Easy seed 1, masked.
 *
 * `?` is a blank digit, `#` a block. Three of seven digit cells are blank, which
 * is the 43% Easy achieves against its 40% target.
 */
export const STARTER_BOARD = `
  # # 2 # ?
  # # + # -
  # # 1 # 1
  # # = # =
  3 + ? = ?
`

export const STARTER_DIFFICULTY = Difficulty.Easy

/** A fresh copy. Callers mutate what they get, so this must not be shared. */
export function starterGrid(): Grid {
  return gridFromText(STARTER_BOARD)
}
