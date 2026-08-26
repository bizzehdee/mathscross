/**
 * The playing screen. Plan sections 5.8, 8.5, 8.6, 8.7 and 8.8.
 *
 * Owns the game state and wires the board, the keypad, the controls, the
 * onboarding card and the generating state together. Everything it renders comes
 * from `GameState` and `boardStatus`; it computes no arithmetic of its own.
 */
import { Difficulty } from '../engine/difficulty'
import { starterGrid, STARTER_DIFFICULTY } from '../engine/starter'
import { CellKind, EMPTY } from '../engine/types'
import { drawSeed, GenerateClient } from '../game/generate-client'
import {
  clear as clearCell,
  createGameState,
  enter,
  isEditable,
  redo,
  undo,
  type GameState,
} from '../game/state'
import { bindTimerToVisibility, createTimer } from '../game/timer'
import { createBoardView, type BoardView } from './board/board'
import { createControlsView, type ControlsView } from './controls/controls'
import { createKeypadView, type KeypadView } from './keypad/keypad'
import { createOnboardingView } from './onboarding/onboarding'

/** How long generation may run before the player is told it is working. */
const GENERATING_NOTICE_MS = 150

/** How often the clock display refreshes. */
const CLOCK_TICK_MS = 1000

export interface AppOptions {
  readonly version: string
  /** Overridden by tests to avoid spawning a real worker. */
  readonly client?: Pick<GenerateClient, 'request'>
}

export function mountApp(mount: HTMLElement, options: AppOptions): void {
  mount.replaceChildren()

  const header = document.createElement('header')
  header.className = 'header'
  const title = document.createElement('h1')
  title.textContent = 'MathsCross'
  const difficultyLabel = document.createElement('span')
  difficultyLabel.className = 'header__difficulty'
  header.append(title, difficultyLabel)

  const status = document.createElement('p')
  status.className = 'status'
  // The live region section 8.8 requires. Equation state changes are announced
  // here, so a screen reader user learns an equation became correct without
  // having to walk the grid looking for it.
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const layout = document.createElement('div')
  layout.className = 'layout'

  const footer = document.createElement('p')
  footer.className = 'status status--version'
  footer.textContent = `Version ${options.version}`

  const onboarding = createOnboardingView({
    onDismiss: () => {
      // Persisted in settings at M5. Until then the card shows once per load,
      // which is the correct behaviour with nothing to remember it in.
      dismissedOnboarding = true
    },
  })

  mount.append(header, onboarding.element, status, layout, footer)

  let dismissedOnboarding = false
  let current: Session | null = null
  // Declared before the first `start()` call below. `start` is hoisted but this is
  // not: reading it from `announce` during the initial mount would otherwise throw.
  let lastAnnouncement = ''
  const client = options.client ?? new GenerateClient()

  // The first board is the bundled one, so a new player waits for nothing. Plan
  // section 5.8.
  start(starterGrid(), STARTER_DIFFICULTY, 'Starter puzzle')
  if (!dismissedOnboarding) {
    onboarding.show()
  }

  interface Session {
    readonly state: GameState
    readonly board: BoardView
    readonly keypad: KeypadView
    readonly controls: ControlsView
    readonly stopClock: () => void
    readonly detachVisibility: () => void
  }

  function start(puzzle: ReturnType<typeof starterGrid>, difficulty: Difficulty, label: string): void {
    current?.stopClock()
    current?.detachVisibility()

    const state = createGameState(puzzle, difficulty)
    const timer = createTimer()
    timer.start()
    const detachVisibility = bindTimerToVisibility(timer)

    const board = createBoardView(state, {
      onSelect: (cell) => {
        keypad.showFor(state.board.kinds[cell], isSignCell(state, cell))
      },
      onType: (cell, value) => apply(cell, value),
      onClear: (cell) => {
        if (clearCell(state, cell) === 'applied') {
          refresh()
        }
      },
    })

    const keypad = createKeypadView(difficulty, {
      onValue: (value) => {
        const cell = board.focused
        if (cell !== null) {
          apply(cell, value)
        }
      },
      onClear: () => {
        const cell = board.focused
        if (cell !== null && clearCell(state, cell) === 'applied') {
          refresh()
        }
      },
    })

    const controls = createControlsView(state, timer, {
      onUndo: () => {
        const cell = undo(state)
        if (cell !== null) {
          board.focus(cell)
          refresh()
        }
      },
      onRedo: () => {
        const cell = redo(state)
        if (cell !== null) {
          board.focus(cell)
          refresh()
        }
      },
    })

    const tick = window.setInterval(() => controls.render(), CLOCK_TICK_MS)

    layout.replaceChildren(board.element, keypad.element, controls.element)
    difficultyLabel.textContent = label

    current = {
      state,
      board,
      keypad,
      controls,
      stopClock: () => window.clearInterval(tick),
      detachVisibility,
    }

    const focused = board.focused
    keypad.showFor(
      focused === null ? undefined : state.board.kinds[focused],
      focused !== null && isSignCell(state, focused),
    )
    refresh()

    function apply(cell: number, value: number): void {
      if (!isEditable(state, cell)) {
        return
      }
      if (enter(state, cell, value) === 'applied') {
        refresh()
      }
    }

    function refresh(): void {
      board.render()
      controls.render()
      announce(board)
    }
  }

  function announce(board: BoardView): void {
    const { board: boardState, equations } = board.status
    const satisfied = equations.filter((entry) => entry.state === 'satisfied').length

    const message =
      boardState === 'solved'
        ? 'Solved. Every equation is correct.'
        : boardState === 'invalid'
          ? `All cells filled, but ${equations.length - satisfied} of ${equations.length} equations are wrong.`
          : `${satisfied} of ${equations.length} equations correct.`

    // Only speak on change. Rewriting an identical message makes some screen
    // readers repeat it on every keystroke.
    if (message !== lastAnnouncement) {
      status.textContent = message
      lastAnnouncement = message
    }
  }

  /** Whether a cell is a sign position, where only minus is legal. */
  function isSignCell(state: GameState, cell: number): boolean {
    if (state.board.kinds[cell] !== CellKind.Operator) {
      return false
    }
    for (const index of state.parsed.equationsByCell[cell] ?? []) {
      const equation = state.parsed.equations[index]
      for (const token of equation?.tokens ?? []) {
        if (token.kind === 'operator' && token.cell === cell && token.role === 'sign') {
          return true
        }
      }
    }
    return false
  }

  // Exposed for the difficulty menu at M4. Kept here so the generating state and
  // the session lifecycle live in one place rather than being duplicated later.
  Object.assign(mount, {
    mathscrossNewGame: (difficulty: Difficulty): void => {
      const seed = drawSeed()
      const notice = window.setTimeout(() => {
        status.textContent = 'Generating a puzzle…'
      }, GENERATING_NOTICE_MS)

      const handle = client.request(seed, difficulty, {
        onProgress: (attempt) => {
          status.textContent = `Generating a puzzle… (attempt ${attempt})`
        },
      })

      void handle.puzzle.then((outcome) => {
        window.clearTimeout(notice)
        if (!outcome.ok) {
          status.textContent =
            outcome.reason === 'cancelled'
              ? 'Cancelled.'
              : 'Could not make a puzzle. Please try again.'
          return
        }
        start(outcome.puzzle.grid, difficulty, difficulty)
      })
    },
  })
}

/** Whether a value counts as filled. Exported for tests. */
export function isFilled(value: number | undefined): boolean {
  return value !== undefined && value !== EMPTY
}
