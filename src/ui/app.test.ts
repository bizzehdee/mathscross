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
import { loadStats, type StorageLike } from '../game/persist'
import { mountApp } from './app'

/**
 * A fresh in-memory storage per test.
 *
 * The app resumes from storage now, and jsdom's localStorage is shared across every
 * test in a file — so without this, one test's half-finished board is restored into
 * the next and the assertions drift. Injecting it also fixes "today", which the
 * daily depends on.
 */
function memoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

const TODAY = new Date('2026-08-26T12:00:00Z')

function mount(overrides: Partial<Parameters<typeof mountApp>[1]> = {}): HTMLElement {
  const root = document.createElement('div')
  root.id = 'app'
  document.body.replaceChildren(root)
  mountApp(root, {
    version: 'test',
    client: { request: () => never() },
    storage: memoryStorage(),
    now: () => TODAY,
    themeRoot: document.createElement('div'),
    ...overrides,
  })
  return root
}

/** Difficulty buttons only, excluding the Daily button they share a group with. */
function difficultyButtons(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.menu [data-difficulty]')]
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
    const buttons = difficultyButtons(root)

    expect(buttons.map((b) => b.textContent)).toEqual(['Easy', 'Medium', 'Hard'])
    // The label says what the difficulty actually involves, so a player choosing
    // Hard knows division and hidden operators are coming.
    expect(buttons[2]?.getAttribute('aria-label')).toContain('every operator hidden')
  })

  it('marks the difficulty in play as pressed', () => {
    const root = mount()
    const easy = difficultyButtons(root)[0]

    expect(easy?.getAttribute('aria-pressed')).toBe('true')
  })

  it('asks before discarding a part-solved puzzle', () => {
    // One free-play slot, so a new puzzle replaces the current one. Losing a
    // half-finished board to a mis-tap would be the most annoying possible bug.
    const asked: string[] = []
    const root = mount({
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    // Enter something, so there is progress worth protecting.
    const blank = [...root.querySelectorAll<HTMLElement>('[data-editable="true"]')][0]
    blank?.click()
    root.querySelector<HTMLElement>('.keypad__pad--digits [aria-label="Digit 4"]')?.click()

    difficultyButtons(root)[1]?.click()

    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('will be lost')
  })

  it('does not ask when nothing has been entered', () => {
    // Confirming something the player has not invested in is friction for its own
    // sake.
    const asked: string[] = []
    const root = mount({
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    difficultyButtons(root)[1]?.click()

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

    difficultyButtons(withCancel)[2]?.click()
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

    difficultyButtons(root)[1]?.click()

    return Promise.resolve().then(() => {
      expect(root.querySelector('.status')?.textContent).toContain('Please try again')
      // The board is still there and still playable.
      expect(root.querySelectorAll('[data-editable="true"]').length).toBeGreaterThan(0)
    })
  })
})

describe('resuming', () => {
  it('restores a board, its entries and its undo history', () => {
    // The moment a player most needs undo is right after returning to a
    // half-finished board. Plan section 8.6.
    const storage = memoryStorage()
    const first = mount({ storage })

    const blank = [...first.querySelectorAll<HTMLElement>('[data-editable="true"]')][0]
    const index = blank?.getAttribute('data-cell')
    blank?.click()
    first.querySelector<HTMLElement>('.keypad__pad--digits [aria-label="Digit 5"]')?.click()

    const second = mount({ storage })

    expect(second.querySelector(`[data-cell="${index}"]`)?.textContent).toBe('5')
    expect((undoButton(second) as HTMLButtonElement).disabled).toBe(false)
  })

  it('falls back to the bundled board when nothing is stored', () => {
    const root = mount()
    expect(root.querySelector('.header__difficulty')?.textContent).toBe('Starter puzzle')
  })
})

describe('the daily', () => {
  it('is offered, and says when it rolls over', () => {
    // UTC rollover means 01:00 local during British Summer Time. A known property
    // rather than a bug report. Plan section 7.4.
    const root = mount()
    const daily = dailyButton(root)

    expect(daily.textContent).toBe('Daily')
    expect(daily.title).toContain('midnight UTC')
  })

  it('resumes today’s daily rather than regenerating it', () => {
    // What makes a player's daily immune to a later generator change: once seen,
    // that board is theirs. Plan section 5.7.
    const storage = memoryStorage()
    let requests = 0
    const root = mount({
      storage,
      client: {
        request: (seed, difficulty) => {
          requests += 1
          return {
            puzzle: Promise.resolve({
              ok: true as const,
              puzzle: {
                seed,
                difficulty,
                generatorVersion: 1,
                grid: starterGrid(),
                density: {
                  digitsMasked: 3,
                  digitsTotal: 7,
                  digitRatio: 0.43,
                  digitTarget: 0.4,
                  operatorsMasked: 0,
                  operatorsTotal: 3,
                  operatorRatio: 0,
                  operatorTarget: 0,
                  uniquenessChecks: 3,
                },
                attempts: 1,
              },
            }),
            cancel: () => {},
          }
        },
      },
    })

    dailyButton(root).click()

    return Promise.resolve()
      .then(() => {
        expect(requests).toBe(1)
        expect(root.querySelector('.header__difficulty')?.textContent).toBe('Daily')
        // Asking again resumes from the slot instead of generating.
        dailyButton(root).click()
        return Promise.resolve()
      })
      .then(() => {
        expect(requests).toBe(1)
      })
  })
})

describe('completing a puzzle', () => {
  it('records it in the statistics, once', () => {
    const storage = memoryStorage()
    const root = mount({ storage })

    for (const [cell, value] of solution()) {
      cellAt(root, cell).click()
      keypadDigit(root, value).click()
    }

    expect(root.querySelector('.stats__daily')?.textContent).toContain('No daily puzzles')
    const easyRow = root.querySelector('.stats__row')
    expect(easyRow?.textContent).toContain('easy')
    // One completion, and clearing then refilling a cell must not add another.
    expect(loadStats(storage).byDifficulty.easy.completed).toBe(1)

    const [firstCell, firstValue] = solution()[0] ?? [0, 0]
    cellAt(root, firstCell).click()
    keypadDigit(root, (firstValue + 1) % 10).click()
    keypadDigit(root, firstValue).click()

    expect(loadStats(storage).byDifficulty.easy.completed).toBe(1)
  })

  it('clears the slot, so a solved board is not resumed', () => {
    const storage = memoryStorage()
    const root = mount({ storage })
    for (const [cell, value] of solution()) {
      cellAt(root, cell).click()
      keypadDigit(root, value).click()
    }

    const again = mount({ storage })
    expect(again.querySelector('.header__difficulty')?.textContent).toBe('Starter puzzle')
  })
})

describe('theme', () => {
  it('applies and remembers a choice', () => {
    const storage = memoryStorage()
    const themeRoot = document.createElement('div')
    const root = mount({ storage, themeRoot })

    themeButton(root, 'Dark').click()
    expect(themeRoot.getAttribute('data-theme')).toBe('dark')

    const again = document.createElement('div')
    mount({ storage, themeRoot: again })
    expect(again.getAttribute('data-theme')).toBe('dark')
  })

  it('removes the attribute for system, rather than setting a value', () => {
    // data-theme="system" matches no rule in tokens.css and would silently give
    // the light palette on a device set to dark. Plan section 8.1.
    const themeRoot = document.createElement('div')
    const root = mount({ themeRoot })

    themeButton(root, 'Dark').click()
    themeButton(root, 'System').click()

    expect(themeRoot.hasAttribute('data-theme')).toBe(false)
  })
})

function dailyButton(root: HTMLElement): HTMLElement {
  const button = [...root.querySelectorAll<HTMLElement>('.menu .button')].find(
    (element) => element.textContent === 'Daily',
  )
  if (button === undefined) {
    throw new Error('No daily button')
  }
  return button
}

function themeButton(root: HTMLElement, label: string): HTMLElement {
  const button = [...root.querySelectorAll<HTMLElement>('.settings__themes .button')].find(
    (element) => element.textContent === label,
  )
  if (button === undefined) {
    throw new Error(`No theme button ${label}`)
  }
  return button
}
