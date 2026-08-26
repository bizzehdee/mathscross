// @vitest-environment jsdom
/**
 * The integration test plan section 13.7 requires: drive a puzzle to completion
 * through the DOM.
 *
 * The real `GenerateClient` is not used. It spawns a Worker, which jsdom has no
 * implementation for, and the point here is the playing screen rather than
 * generation — which the engine suite already covers thoroughly. A stub stands in.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { parametersFor } from '../engine/difficulty'
import { solve } from '../engine/solver'
import { STARTER_DIFFICULTY, starterGrid } from '../engine/starter'
import { CellKind, EMPTY } from '../engine/types'
import { mountApp } from './app'

function mount(): HTMLElement {
  const root = document.createElement('div')
  root.id = 'app'
  document.body.replaceChildren(root)
  mountApp(root, { version: 'test', client: { request: () => never() } })
  return root
}

/** A request that never settles. Nothing in these tests starts a new game. */
function never(): { puzzle: Promise<never>; cancel: () => void } {
  return { puzzle: new Promise<never>(() => {}), cancel: () => {} }
}

function cells(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-cell]')]
}

function editable(root: HTMLElement): HTMLElement[] {
  return cells(root).filter((cell) => cell.getAttribute('data-editable') === 'true')
}

function keypadDigit(root: HTMLElement, digit: number): HTMLElement {
  const key = root.querySelector<HTMLElement>(`.keypad__pad--digits [aria-label="Digit ${digit}"]`)
  if (key === null) {
    throw new Error(`No keypad key for digit ${digit}`)
  }
  return key
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe('the first launch', () => {
  it('shows a board immediately, with no wait', () => {
    // Plan section 5.8: on a fresh install nothing is cached, so the bundled
    // starter board is what stops a new player watching a spinner at exactly the
    // moment they decide whether to keep the app.
    const root = mount()

    expect(root.querySelector('[role="grid"]')).not.toBeNull()
    expect(editable(root).length).toBeGreaterThan(0)
  })

  it('shows the onboarding card, whose subject is multi-cell numbers', () => {
    // Not arithmetic. The game uses ordinary BODMAS, so there is nothing to teach
    // there, and saying the normal rules apply invites a hunt for a catch.
    // Plan section 8.7.
    const root = mount()
    const card = root.querySelector<HTMLElement>('.onboarding')

    expect(card?.hidden).toBe(false)
    expect(card?.textContent).toContain('one number')
    expect(card?.textContent?.toLowerCase()).not.toContain('bodmas')
  })

  it('dismisses the card on request', () => {
    const root = mount()
    root.querySelector<HTMLElement>('.onboarding .button')?.click()

    expect(root.querySelector<HTMLElement>('.onboarding')?.hidden).toBe(true)
  })

  it('reports progress rather than nothing', () => {
    const root = mount()
    expect(root.querySelector('.status')?.textContent).toMatch(/equations correct/)
  })
})

describe('playing a puzzle to completion', () => {
  it('accepts keypad entry and reaches the solved state', () => {
    const root = mount()
    const blanks = editable(root)
    expect(blanks.length).toBeGreaterThan(0)

    // The starter board is Easy seed 1:
    //   # # 2 # ?      column 2 reads 2 + 1 = 3, so the blanks resolve
    //   # # + # -      to a single answer per cell. Solve it the way a player
    //   # # 1 # 1      would: click a cell, then press a digit.
    //   # # = # =
    //   3 + ? = ?
    for (const [cell, value] of solution()) {
      cellAt(root, cell).click()
      keypadDigit(root, value).click()
    }

    expect(root.querySelector('.status')?.textContent).toContain('Solved')
  })

  it('marks every equation satisfied once solved', () => {
    const root = mount()
    for (const [cell, value] of solution()) {
      cellAt(root, cell).click()
      keypadDigit(root, value).click()
    }

    const markers = [...root.querySelectorAll('[data-equation-state]')]
    expect(markers.length).toBeGreaterThan(0)
    for (const marker of markers) {
      expect(marker.getAttribute('data-equation-state')).toBe('satisfied')
    }
  })
})

describe('undo and redo', () => {
  it('reverts one entry and restores it', () => {
    const root = mount()
    const first = editable(root)[0]
    const index = Number(first?.getAttribute('data-cell'))

    first?.click()
    keypadDigit(root, 4).click()
    expect(cellAt(root, index).textContent).toBe('4')

    undoButton(root).click()
    expect(cellAt(root, index).textContent).toBe('')

    redoButton(root).click()
    expect(cellAt(root, index).textContent).toBe('4')
  })

  it('disables undo before any move, and redo before any undo', () => {
    const root = mount()

    expect((undoButton(root) as HTMLButtonElement).disabled).toBe(true)
    expect((redoButton(root) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('the keypad follows the focused cell', () => {
  it('offers digits for a digit cell and hides operators', () => {
    const root = mount()
    const digitCell = editable(root).find(
      (cell) => cell.getAttribute('data-kind') === 'digit',
    )
    digitCell?.click()

    expect(root.querySelector<HTMLElement>('.keypad__pad--digits')?.hidden).toBe(false)
    expect(root.querySelector<HTMLElement>('.keypad__pad--operators')?.hidden).toBe(true)
  })
})

function cellAt(root: HTMLElement, index: number): HTMLElement {
  const cell = root.querySelector<HTMLElement>(`[data-cell="${index}"]`)
  if (cell === null) {
    throw new Error(`No cell ${index}`)
  }
  return cell
}

function undoButton(root: HTMLElement): HTMLElement {
  const button = [...root.querySelectorAll<HTMLElement>('.controls .button')].find(
    (element) => element.textContent === 'Undo',
  )
  if (button === undefined) {
    throw new Error('No undo button')
  }
  return button
}

function redoButton(root: HTMLElement): HTMLElement {
  const button = [...root.querySelectorAll<HTMLElement>('.controls .button')].find(
    (element) => element.textContent === 'Redo',
  )
  if (button === undefined) {
    throw new Error('No redo button')
  }
  return button
}

/**
 * The answer for each blank, from the engine.
 *
 * An earlier version tried each digit through the UI and kept the one the board
 * did not mark wrong. That does not work: a cell is only marked wrong once its
 * equation is *unsatisfied*, and while other cells are still blank the equation is
 * `incomplete`, so every digit looked acceptable and the first one tried was
 * accepted.
 *
 * Using the solver for the expected values does not weaken the test. What is under
 * test is the playing screen — that clicking a cell and pressing a key writes the
 * value, redraws the board, updates each equation's marker and reaches the solved
 * state. The assertions on `textContent` and `data-equation-state` cover the render
 * path; the engine only supplies what a player would have worked out.
 */
function solution(): [number, number][] {
  const grid = starterGrid()
  const parameters = parametersFor(STARTER_DIFFICULTY)
  const result = solve(grid, { operators: parameters.operators, maxSolutions: 1 })
  if (result.first === null) {
    throw new Error('the bundled starter puzzle has no solution')
  }

  const answers: [number, number][] = []
  for (let cell = 0; cell < grid.kinds.length; cell += 1) {
    if (grid.kinds[cell] === CellKind.Digit && grid.values[cell] === EMPTY) {
      answers.push([cell, result.first[cell] ?? 0])
    }
  }
  return answers
}

describe('the difficulty menu', () => {
  it('offers all three difficulties, describing what each asks', () => {
    const root = mount()
    const buttons = [...root.querySelectorAll<HTMLElement>('.menu .button')]

    expect(buttons.map((b) => b.textContent)).toEqual(['Easy', 'Medium', 'Hard'])
    // The label says what the difficulty actually involves, so a player choosing
    // Hard knows division and hidden operators are coming.
    expect(buttons[2]?.getAttribute('aria-label')).toContain('every operator hidden')
  })

  it('marks the difficulty in play as pressed', () => {
    const root = mount()
    const easy = root.querySelector<HTMLElement>('.menu .button')

    expect(easy?.getAttribute('aria-pressed')).toBe('true')
  })

  it('asks before discarding a part-solved puzzle', () => {
    // One free-play slot, so a new puzzle replaces the current one. Losing a
    // half-finished board to a mis-tap would be the most annoying possible bug.
    const asked: string[] = []
    const root = document.createElement('div')
    document.body.replaceChildren(root)
    mountApp(root, {
      version: 'test',
      client: { request: () => never() },
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    // Enter something, so there is progress worth protecting.
    const blank = [...root.querySelectorAll<HTMLElement>('[data-editable="true"]')][0]
    blank?.click()
    root.querySelector<HTMLElement>('.keypad__pad--digits [aria-label="Digit 4"]')?.click()

    root.querySelectorAll<HTMLElement>('.menu .button')[1]?.click()

    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('will be lost')
  })

  it('does not ask when nothing has been entered', () => {
    // Confirming something the player has not invested in is friction for its own
    // sake.
    const asked: string[] = []
    const root = document.createElement('div')
    document.body.replaceChildren(root)
    mountApp(root, {
      version: 'test',
      client: { request: () => never() },
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    root.querySelectorAll<HTMLElement>('.menu .button')[1]?.click()

    expect(asked).toHaveLength(0)
  })
})

describe('the generating state', () => {
  it('offers a cancel control while a puzzle is being made', () => {
    // Plan section 5.6: a player must never face a frozen screen, and must always
    // be able to give up waiting.
    const root = mount()
    let cancelled = false
    document.body.replaceChildren(root)

    const withCancel = document.createElement('div')
    document.body.replaceChildren(withCancel)
    mountApp(withCancel, {
      version: 'test',
      confirmDiscard: () => true,
      client: {
        request: () => ({
          puzzle: new Promise<never>(() => {}),
          cancel: () => {
            cancelled = true
          },
        }),
      },
    })

    withCancel.querySelectorAll<HTMLElement>('.menu .button')[2]?.click()
    withCancel.querySelector<HTMLElement>('.generating .button')?.click()

    expect(cancelled).toBe(true)
  })

  it('reports a failed generation without breaking the current puzzle', () => {
    const root = document.createElement('div')
    document.body.replaceChildren(root)
    mountApp(root, {
      version: 'test',
      confirmDiscard: () => true,
      client: {
        request: () => ({
          puzzle: Promise.resolve({ ok: false as const, reason: 'exhausted' as const }),
          cancel: () => {},
        }),
      },
    })

    root.querySelectorAll<HTMLElement>('.menu .button')[1]?.click()

    return Promise.resolve().then(() => {
      expect(root.querySelector('.status')?.textContent).toContain('Please try again')
      // The board is still there and still playable.
      expect(root.querySelectorAll('[data-editable="true"]').length).toBeGreaterThan(0)
    })
  })
})
