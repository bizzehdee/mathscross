// @vitest-environment jsdom
/**
 * Board rendering, keyboard entry and accessibility. Plan section 13.7.
 *
 * Only this file and app.test.ts need a DOM, so the environment is set per file
 * rather than globally: the engine suite stays in Node, where it is faster.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { Difficulty } from '../../engine/difficulty'
import { gridFromText } from '../../engine/grid'
import { clear, createGameState, enter, type GameState } from '../../game/state'
import { createBoardView, type BoardView } from './board'

/** Easy 5x5, two blanks: the result of the first row and of the last. */
const EASY = `
  1 + 2 = ?
  + # + # +
  2 + 1 = 3
  = # = # =
  3 + 3 = ?
`

/** A 7x7 with a two-cell number, for the grouping cue and its labels. */
const WITH_MULTI_CELL = `
  1 5 + 3 = 1 8
  # # # # # # #
  # # # # # # #
  # # # # # # #
  # # # # # # #
  # # # # # # #
  # # # # # # #
`

function mount(board: string, difficulty: Difficulty = Difficulty.Easy): {
  state: GameState
  view: BoardView
  selected: number[]
  typed: [number, number][]
} {
  const state = createGameState(gridFromText(board), difficulty)
  const selected: number[] = []
  const typed: [number, number][] = []
  const view = createBoardView(state, {
    onSelect: (cell) => selected.push(cell),
    onType: (cell, value) => {
      typed.push([cell, value])
      enter(state, cell, value)
      view.render()
    },
    onClear: (cell) => {
      clear(state, cell)
      view.render()
    },
  })
  document.body.replaceChildren(view.element)
  return { state, view, selected, typed }
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe('grid semantics', () => {
  it('exposes a grid with rows of gridcells', () => {
    const { view } = mount(EASY)

    expect(view.element.getAttribute('role')).toBe('grid')
    expect(view.element.querySelectorAll('[role="row"]')).toHaveLength(5)
    expect(view.element.querySelectorAll('[role="gridcell"]').length).toBeGreaterThan(0)
  })

  it('hides block cells from assistive technology', () => {
    // A block carries no information, and announcing dozens of them would bury
    // the cells that matter.
    const { view } = mount(EASY)
    const blocks = view.element.querySelectorAll('.cell--block')

    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('is a single tab stop, with exactly one tabbable cell', () => {
    const { view } = mount(EASY)
    const tabbable = view.element.querySelectorAll('[data-cell][tabindex="0"]')

    expect(tabbable).toHaveLength(1)
  })

  it('moves the tab stop with focus, so the board stays one stop', () => {
    const { view } = mount(EASY)
    view.focus(24)

    const tabbable = view.element.querySelectorAll('[data-cell][tabindex="0"]')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]?.getAttribute('data-cell')).toBe('24')
  })
})

describe('cell labels', () => {
  it('names a digit and its place within a multi-cell number', () => {
    // A bare digit is meaningless when numbers span cells: hearing "one" says
    // nothing about whether it is one, ten or part of 15. Plan section 8.8.
    const { view } = mount(WITH_MULTI_CELL, Difficulty.Medium)
    const label = view.element.querySelector('[data-cell="0"]')?.getAttribute('aria-label') ?? ''

    expect(label).toContain('digit 1')
    expect(label).toContain('first of 2 digits')
  })

  it('says empty for an unfilled cell rather than nothing', () => {
    const { view } = mount(EASY)
    const label = view.element.querySelector('[data-cell="4"]')?.getAttribute('aria-label') ?? ''

    expect(label).toContain('empty digit')
  })

  it('marks a given as given', () => {
    const { view } = mount(EASY)
    const label = view.element.querySelector('[data-cell="0"]')?.getAttribute('aria-label') ?? ''

    expect(label).toContain('given')
  })

  it('announces equation state on the equals cell', () => {
    const { view } = mount(EASY)
    const label = view.element.querySelector('[data-cell="3"]')?.getAttribute('aria-label') ?? ''

    expect(label).toContain('equals')
    expect(label).toMatch(/equation (correct|incomplete|unsatisfied)/)
  })

  it('flags a cell two equations cross', () => {
    const { view } = mount(EASY)
    const label = view.element.querySelector('[data-cell="0"]')?.getAttribute('aria-label') ?? ''

    expect(label).toContain('shared by two equations')
  })
})

describe('equation state is not conveyed by colour alone', () => {
  it('reflects state in an attribute, so a glyph and weight can follow', () => {
    // Plan section 8.8: red and green is exactly the encoding that fails most
    // often, and this is a three-state distinction. The attribute is what the
    // stylesheet hangs the non-colour channels on.
    const { state, view } = mount(EASY)
    const equals = view.element.querySelector('[data-cell="3"]')

    expect(equals?.getAttribute('data-equation-state')).toBe('incomplete')

    enter(state, 4, 3)
    view.render()
    expect(equals?.getAttribute('data-equation-state')).toBe('satisfied')

    enter(state, 4, 9)
    view.render()
    expect(equals?.getAttribute('data-equation-state')).toBe('unsatisfied')
  })
})

describe('the grouping cue', () => {
  it('marks the position of each cell in a multi-cell number', () => {
    // Without a cue the player cannot tell 1 5 from two separate operands, which
    // is the misreading most likely to make correct answers look rejected.
    const { view } = mount(WITH_MULTI_CELL, Difficulty.Medium)

    expect(view.element.querySelector('[data-cell="0"]')?.getAttribute('data-group')).toContain(
      'start',
    )
    expect(view.element.querySelector('[data-cell="1"]')?.getAttribute('data-group')).toContain(
      'end',
    )
  })

  it('leaves a single-digit number ungrouped', () => {
    const { view } = mount(EASY)

    expect(view.element.querySelector('[data-cell="0"]')?.hasAttribute('data-group')).toBe(false)
  })
})

describe('keyboard entry', () => {
  it('enters a digit typed on a focused cell', () => {
    const { state, view, typed } = mount(EASY)
    view.focus(4)

    view.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }),
    )

    expect(typed).toEqual([[4, 3]])
    expect(state.board.values[4]).toBe(3)
  })

  it('clears a cell on backspace', () => {
    const { state, view } = mount(EASY)
    view.focus(4)
    enter(state, 4, 3)

    view.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
    )

    expect(state.board.values[4]).toBe(-1)
  })

  it('moves focus with the arrow keys, skipping blocks', () => {
    const { view } = mount(EASY)
    view.focus(4)

    // Cell 9 below is an operator cell of the column equation, so down from 4
    // lands there rather than on a block.
    view.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )

    expect(view.focused).toBe(9)
  })

  it('stays put at the edge rather than wrapping', () => {
    const { view } = mount(EASY)
    view.focus(4)

    view.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    )

    expect(view.focused).toBe(4)
  })
})

describe('rendering values', () => {
  it('renders an operator as its glyph, never its stored form', () => {
    const { view } = mount(EASY)
    const operator = view.element.querySelector('[data-cell="1"]')

    expect(operator?.textContent).toBe('+')
  })

  it('renders the equals cell', () => {
    const { view } = mount(EASY)
    expect(view.element.querySelector('[data-cell="3"]')?.textContent).toBe('=')
  })

  it('leaves an unfilled cell blank', () => {
    const { view } = mount(EASY)
    expect(view.element.querySelector('[data-cell="4"]')?.textContent).toBe('')
  })
})
