// @vitest-environment jsdom
/**
 * The application shell: screens, navigation, and a puzzle driven to completion
 * through the DOM. Plan section 13.7.
 *
 * The real `GenerateClient` is not used. It spawns a Worker, which jsdom has no
 * implementation for, and what is under test here is the shell rather than
 * generation — which the engine suite covers thoroughly.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { parametersFor } from '../engine/difficulty'
import { solve } from '../engine/solver'
import { STARTER_DIFFICULTY, starterGrid } from '../engine/starter'
import { CellKind, EMPTY } from '../engine/types'
import { loadBoard, loadStats, type StorageLike } from '../game/persist'
import { mountApp, type AppOptions } from './app'

/**
 * A fresh in-memory storage per test.
 *
 * jsdom's localStorage is shared across every test in a file, so without this one
 * test's half-finished board is restored into the next. Fixing "today" matters for
 * the same reason: the daily depends on it.
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

/** A clock the test moves by hand, so nothing waits for real time. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let value = 1_000
  return {
    now: () => value,
    advance: (ms) => {
      value += ms
    },
  }
}

/** 2026-08-26 is a Wednesday, so the daily is Medium. */
const TODAY = new Date('2026-08-26T12:00:00Z')

function never(): { puzzle: Promise<never>; cancel: () => void } {
  return { puzzle: new Promise<never>(() => {}), cancel: () => {} }
}

/** A client that resolves immediately with the bundled starter board. */
function starterClient(counter?: { requests: number }): NonNullable<AppOptions['client']> {
  return {
    request: (seed, difficulty) => {
      if (counter !== undefined) {
        counter.requests += 1
      }
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
  }
}

function mount(overrides: Partial<AppOptions> = {}): HTMLElement {
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

/**
 * Mounts with onboarding already dismissed, which is the ordinary case.
 *
 * Seeds settings only when there are none. Writing them unconditionally clobbered
 * whatever the app had just saved, which made a remount look as though a setting
 * had not persisted.
 */
function mountReady(overrides: Partial<AppOptions> = {}): HTMLElement {
  const storage = overrides.storage ?? memoryStorage()
  if (storage.getItem('mathscross.settings.v1') === null) {
    storage.setItem(
      'mathscross.settings.v1',
      JSON.stringify({ v: 1, theme: 'system', onboardingDismissed: true }),
    )
  }
  return mount({ ...overrides, storage })
}

function visibleScreen(root: HTMLElement): string {
  const shown = [...root.querySelectorAll<HTMLElement>('.screen')].find((screen) => !screen.hidden)
  return shown?.className.replace('screen screen--', '') ?? 'none'
}

function button(root: HTMLElement, label: string): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (element) => element.textContent === label,
  )
  if (found === undefined) {
    throw new Error(`No button labelled ${label}`)
  }
  return found
}

function editable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-editable="true"]')]
}

function cellAt(root: HTMLElement, index: number): HTMLElement {
  const cell = root.querySelector<HTMLElement>(`[data-cell="${index}"]`)
  if (cell === null) {
    throw new Error(`No cell ${index}`)
  }
  return cell
}

function keypadDigit(root: HTMLElement, digit: number): HTMLElement {
  const key = root.querySelector<HTMLElement>(`.keypad__pad--digits [aria-label="Digit ${digit}"]`)
  if (key === null) {
    throw new Error(`No keypad key for digit ${digit}`)
  }
  return key
}

/** The answers for the bundled starter board, from the engine. */
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

function solveThroughUi(root: HTMLElement): void {
  for (const [cell, value] of solution()) {
    cellAt(root, cell).click()
    keypadDigit(root, value).click()
  }
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe('the start screen', () => {
  it('opens on home, not on a board', () => {
    // A board that appears unbidden answers a question nobody asked.
    const root = mountReady()

    expect(visibleScreen(root)).toBe('home')
    expect(root.querySelector('[role="grid"]')).toBeNull()
  })

  it('offers a new puzzle at each difficulty, describing what each asks', () => {
    const root = mountReady()
    const difficulties = [...root.querySelectorAll<HTMLElement>('[data-difficulty]')]

    expect(difficulties.map((element) => element.textContent)).toEqual(['Easy', 'Medium', 'Hard'])
    expect(difficulties[2]?.getAttribute('aria-label')).toContain('every operator hidden')
  })

  it('offers the daily, and says when it rolls over', () => {
    const daily = mountReady().querySelector<HTMLElement>('[data-daily]')
    expect(daily?.textContent).toBe('Daily')
    expect(daily?.title).toContain('midnight UTC')
  })

  it('offers no continue when nothing is stored', () => {
    const root = mountReady()
    expect(root.querySelector<HTMLElement>('.home__group[aria-label="Continue"]')?.hidden).toBe(true)
  })

  it('hides the back button, since home is the floor', () => {
    expect(mountReady().querySelector<HTMLElement>('.header__back')?.hidden).toBe(true)
  })
})

describe('a first-time player', () => {
  it('lands on how to play, whose subject is multi-cell numbers', () => {
    // Not arithmetic: the game uses ordinary BODMAS, so there is nothing to teach
    // there, and saying the normal rules apply invites a hunt for a catch.
    const root = mount()

    expect(visibleScreen(root)).toBe('howtoplay')
    expect(root.textContent).toContain('one number')
    expect(root.textContent?.toLowerCase()).not.toContain('bodmas')
  })

  it('goes to home once dismissed, and lands there next time', () => {
    const storage = memoryStorage()
    const first = mount({ storage })
    button(first, 'Got it').click()

    expect(visibleScreen(first)).toBe('home')
    expect(visibleScreen(mount({ storage }))).toBe('home')
  })

  it('can reach how to play again from home', () => {
    const root = mountReady()
    button(root, 'How to play').click()

    expect(visibleScreen(root)).toBe('howtoplay')
  })
})

describe('navigation', () => {
  it('reaches statistics and settings as their own screens', () => {
    const root = mountReady()

    button(root, 'Statistics').click()
    expect(visibleScreen(root)).toBe('stats')

    button(root, 'Menu').click()
    expect(visibleScreen(root)).toBe('home')

    button(root, 'Settings').click()
    expect(visibleScreen(root)).toBe('settings')
  })

  it('shows a back button on every screen above home', () => {
    const root = mountReady()
    button(root, 'Statistics').click()

    expect(root.querySelector<HTMLElement>('.header__back')?.hidden).toBe(false)
  })

  it('routes the hardware back button, and reports when there is nothing to leave', () => {
    // Back leaves the current screen and exits only from home. Plan section 8.6.
    const root = mountReady()
    const back = (root as unknown as Record<string, () => boolean>)['mathscrossBack']

    expect(back?.()).toBe(false)

    button(root, 'Statistics').click()
    expect(back?.()).toBe(true)
    expect(visibleScreen(root)).toBe('home')
  })
})

describe('starting and playing a puzzle', () => {
  it('goes to the game screen with a board', async () => {
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    expect(visibleScreen(root)).toBe('game')
    expect(root.querySelector('[role="grid"]')).not.toBeNull()
    expect(editable(root).length).toBeGreaterThan(0)
  })

  it('returns to home from the game, and offers to continue', async () => {
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    editable(root)[0]?.click()
    keypadDigit(root, 4).click()
    button(root, 'Menu').click()

    expect(visibleScreen(root)).toBe('home')
    expect(root.querySelector<HTMLElement>('.home__group[aria-label="Continue"]')?.hidden).toBe(
      false,
    )
    // The label says what would be resumed, so the choice is informed.
    expect(button(root, 'Continue easy').getAttribute('aria-label')).toContain('cells left')
  })

  it('saves the time played up to the moment the board is left, not the last entry', async () => {
    // The defect this covers: the elapsed total was written only when a cell
    // changed, and nothing stopped the clock on leaving the board. A player who
    // entered a digit, thought for half a minute and went back to the menu
    // resumed at the time of the digit, so thinking time was quietly discounted
    // and the menu's "time played" read low.
    const storage = memoryStorage()
    const clock = fakeClock()
    const root = mountReady({ storage, client: starterClient(), clock: clock.now })
    button(root, 'Easy').click()
    await Promise.resolve()

    editable(root)[0]?.click()
    keypadDigit(root, 4).click()

    clock.advance(30_000)
    button(root, 'Menu').click()

    expect(loadBoard('free', storage)?.elapsedMs).toBe(30_000)
  })

  it('stops the clock on the menu, and starts it again on returning', async () => {
    const storage = memoryStorage()
    const clock = fakeClock()
    const root = mountReady({ storage, client: starterClient(), clock: clock.now })
    button(root, 'Easy').click()
    await Promise.resolve()

    button(root, 'Menu').click()
    clock.advance(120_000)
    button(root, 'Continue easy').click()

    // Two minutes on the menu are not two minutes of play.
    expect(loadBoard('free', storage)?.elapsedMs).toBe(0)

    clock.advance(5_000)
    editable(root)[0]?.click()
    keypadDigit(root, 4).click()

    expect(loadBoard('free', storage)?.elapsedMs).toBe(5_000)
  })

  it('reaches the solved state and records one completion', async () => {
    const storage = memoryStorage()
    const root = mountReady({ storage, client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    solveThroughUi(root)

    expect(root.querySelector('.status')?.textContent).toContain('Solved')
    expect(loadStats(storage).byDifficulty.easy.completed).toBe(1)

    // Re-entering a cell must not count a second completion.
    const [first, value] = solution()[0] ?? [0, 0]
    cellAt(root, first).click()
    keypadDigit(root, (value + 1) % 10).click()
    keypadDigit(root, value).click()
    expect(loadStats(storage).byDifficulty.easy.completed).toBe(1)
  })

  it('clears the slot on completion, so a solved board is not offered to continue', async () => {
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    solveThroughUi(root)
    button(root, 'Menu').click()

    expect(root.querySelector<HTMLElement>('.home__group[aria-label="Continue"]')?.hidden).toBe(true)
  })
})

describe('resuming', () => {
  it('restores entries and the undo history', async () => {
    // The moment a player most needs undo is right after returning to a
    // half-finished board. Plan section 8.6.
    const storage = memoryStorage()
    const first = mountReady({ storage, client: starterClient() })
    button(first, 'Easy').click()
    await Promise.resolve()

    const cell = editable(first)[0]
    const index = cell?.getAttribute('data-cell')
    cell?.click()
    keypadDigit(first, 5).click()

    const second = mountReady({ storage, client: starterClient() })
    button(second, 'Continue easy').click()

    expect(visibleScreen(second)).toBe('game')
    expect(second.querySelector(`[data-cell="${index}"]`)?.textContent).toBe('5')
    expect((button(second, 'Undo') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the daily', () => {
  it('resumes today’s daily rather than regenerating it', async () => {
    // What makes a player's daily immune to a later generator change: once seen,
    // that board is theirs. Plan section 5.7.
    const counter = { requests: 0 }
    const root = mountReady({ client: starterClient(counter) })

    root.querySelector<HTMLElement>('[data-daily]')?.click()
    await Promise.resolve()

    expect(counter.requests).toBe(1)
    expect(visibleScreen(root)).toBe('game')

    button(root, 'Menu').click()
    root.querySelector<HTMLElement>('[data-daily]')?.click()
    await Promise.resolve()

    expect(counter.requests).toBe(1)
  })

  it('shows a streak once one exists', () => {
    const storage = memoryStorage()
    storage.setItem(
      'mathscross.stats.v1',
      JSON.stringify({
        v: 1,
        byDifficulty: {},
        daily: { currentStreak: 4, longestStreak: 4, completed: 4, lastDateKey: '20260825' },
      }),
    )

    expect(mountReady({ storage }).querySelector('.home__streak')?.textContent).toContain('4 days')
  })
})

describe('discarding', () => {
  it('asks before replacing a part-solved board', async () => {
    const asked: string[] = []
    const root = mountReady({
      client: starterClient(),
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    button(root, 'Easy').click()
    await Promise.resolve()

    editable(root)[0]?.click()
    keypadDigit(root, 4).click()
    button(root, 'Menu').click()
    button(root, 'Medium').click()

    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('will be lost')
  })

  it('does not ask when nothing has been entered', async () => {
    // Confirming something the player has not invested in is friction for its own
    // sake.
    const asked: string[] = []
    const root = mountReady({
      client: starterClient(),
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    button(root, 'Easy').click()
    await Promise.resolve()

    button(root, 'Menu').click()
    button(root, 'Medium').click()

    expect(asked).toHaveLength(0)
  })

  it('does not ask about a board that is already solved', async () => {
    // Asking to protect work the player has finished is both wrong and irritating.
    const asked: string[] = []
    const root = mountReady({
      client: starterClient(),
      confirmDiscard: (message) => {
        asked.push(message)
        return false
      },
    })

    button(root, 'Easy').click()
    await Promise.resolve()

    solveThroughUi(root)
    button(root, 'Menu').click()
    button(root, 'Medium').click()

    expect(asked).toHaveLength(0)
  })
})

describe('the generating state', () => {
  it('offers a cancel control', () => {
    // Plan section 5.6: a player must never face a frozen screen, and must always
    // be able to give up waiting.
    let cancelled = false
    const root = mountReady({
      client: {
        request: () => ({
          puzzle: new Promise<never>(() => {}),
          cancel: () => {
            cancelled = true
          },
        }),
      },
    })

    button(root, 'Hard').click()
    button(root, 'Cancel').click()

    expect(cancelled).toBe(true)
  })

  it('reports a failure without leaving the player stranded', async () => {
    const root = mountReady({
      client: {
        request: () => ({
          puzzle: Promise.resolve({ ok: false as const, reason: 'exhausted' as const }),
          cancel: () => {},
        }),
      },
    })

    button(root, 'Medium').click()
    await Promise.resolve()

    expect(root.querySelector('.status')?.textContent).toContain('Please try again')
    expect(visibleScreen(root)).toBe('home')
  })
})

describe('theme', () => {
  it('applies and remembers a choice', () => {
    const storage = memoryStorage()
    const themeRoot = document.createElement('div')
    const root = mountReady({ storage, themeRoot })

    button(root, 'Settings').click()
    button(root, 'Dark').click()
    expect(themeRoot.getAttribute('data-theme')).toBe('dark')

    const again = document.createElement('div')
    mountReady({ storage, themeRoot: again })
    expect(again.getAttribute('data-theme')).toBe('dark')
  })

  it('removes the attribute for system, rather than setting a value', () => {
    // data-theme="system" matches no rule in tokens.css and would silently give
    // the light palette on a device set to dark. Plan section 8.1.
    const themeRoot = document.createElement('div')
    const root = mountReady({ themeRoot })

    button(root, 'Settings').click()
    button(root, 'Dark').click()
    button(root, 'System').click()

    expect(themeRoot.hasAttribute('data-theme')).toBe(false)
  })
})

describe('the game screen header', () => {
  it('names the difficulty in play', async () => {
    // Set after navigation, not before: starting a game resets the router through
    // home on its way to the game screen, and that transition clears the subtitle.
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    expect(root.querySelector('.header__difficulty')?.textContent).toBe('easy')
  })

  it('clears it when leaving the game', async () => {
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()
    button(root, 'Menu').click()

    expect(root.querySelector('.header__difficulty')?.textContent).toBe('')
  })
})

describe('finishing a puzzle', () => {
  it('congratulates the player and reports the time', async () => {
    // Finishing is the moment the game exists for, and a line of status text is an
    // anticlimax.
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    solveThroughUi(root)

    const dialog = root.querySelector<HTMLElement>('.completion')
    expect(dialog?.hidden).toBe(false)
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.textContent).toContain('Congratulations')
    expect(dialog?.textContent).toContain('Solved in')
  })

  it('offers another of the same difficulty', async () => {
    // Someone who has just finished a Medium wants another Medium, not a menu
    // asking them to choose again.
    const counter = { requests: 0 }
    const root = mountReady({ client: starterClient(counter) })
    button(root, 'Medium').click()
    await Promise.resolve()

    solveThroughUi(root)

    const another = button(root, 'Another Medium')
    expect(another.getAttribute('aria-label')).toContain('another Medium')

    another.click()
    await Promise.resolve()

    expect(counter.requests).toBe(2)
    expect(visibleScreen(root)).toBe('game')
    expect(root.querySelector<HTMLElement>('.completion')?.hidden).toBe(true)
  })

  it('offers a way back to the menu instead', async () => {
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    solveThroughUi(root)
    button(root, 'Back to menu').click()

    expect(visibleScreen(root)).toBe('home')
    expect(root.querySelector<HTMLElement>('.completion')?.hidden).toBe(true)
  })

  it('reports the streak for a daily, and offers no another', async () => {
    // There is one daily a day, so offering a second would promise what the game
    // cannot give.
    const root = mountReady({ client: starterClient() })
    root.querySelector<HTMLElement>('[data-daily]')?.click()
    await Promise.resolve()

    solveThroughUi(root)

    const dialog = root.querySelector<HTMLElement>('.completion')
    expect(dialog?.hidden).toBe(false)
    expect(dialog?.textContent).toContain('daily')
    expect(
      [...root.querySelectorAll<HTMLElement>('.completion__actions button')].filter(
        (element) => !element.hidden,
      ).length,
    ).toBe(1)
  })

  it('does not appear for a board that is full but wrong', async () => {
    // "Every cell filled" is not "solved". Congratulating a player for a wrong
    // board would be worse than saying nothing.
    const root = mountReady({ client: starterClient() })
    button(root, 'Easy').click()
    await Promise.resolve()

    // Fill every blank with a deliberately wrong digit.
    for (const [cell, value] of solution()) {
      cellAt(root, cell).click()
      keypadDigit(root, (value + 1) % 10).click()
    }

    expect(root.querySelector<HTMLElement>('.completion')?.hidden).toBe(true)
    expect(root.querySelector('.status')?.textContent).toContain('are wrong')
  })
})
