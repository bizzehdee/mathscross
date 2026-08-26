/**
 * The playing screen. Plan sections 5.8, 8.5, 8.6, 8.7 and 8.8.
 *
 * Owns the session and wires the board, keypad, controls, menu, onboarding card
 * and generating state together. Everything it renders comes from `GameState` and
 * `boardStatus`; it computes no arithmetic of its own.
 */
import { type Difficulty } from '../engine/difficulty'
import { starterGrid, STARTER_DIFFICULTY } from '../engine/starter'
import { CellKind, type Grid } from '../engine/types'
import { drawSeed, GenerateClient, type GenerateHandle } from '../game/generate-client'
import {
  clear as clearCell,
  createGameState,
  enter,
  isEditable,
  redo,
  remainingCells,
  undo,
  type GameState,
} from '../game/state'
import { bindTimerToVisibility, createTimer } from '../game/timer'
import { createBoardView, type BoardView } from './board/board'
import { createControlsView, type ControlsView } from './controls/controls'
import { createKeypadView, type KeypadView } from './keypad/keypad'
import { createMenuView } from './menu/menu'
import { createOnboardingView } from './onboarding/onboarding'

/** How long generation may run before the player is told it is working. */
const GENERATING_NOTICE_MS = 150

/** How often the clock display refreshes. */
const CLOCK_TICK_MS = 1000

export interface AppOptions {
  readonly version: string
  /** Replaced in tests, which have no Worker. */
  readonly client?: Pick<GenerateClient, 'request'>
  /**
   * Asks before discarding an in-progress puzzle.
   *
   * Injected so tests need not stub a global. There is one free-play slot, so a
   * new puzzle replaces the current one, and losing a half-finished board to a
   * mis-tap would be the most annoying bug this game could have.
   */
  readonly confirmDiscard?: (message: string) => boolean
}

interface Session {
  readonly state: GameState
  readonly board: BoardView
  readonly keypad: KeypadView
  readonly controls: ControlsView
  readonly dispose: () => void
}

export function mountApp(mount: HTMLElement, options: AppOptions): void {
  mount.replaceChildren()

  const confirmDiscard =
    options.confirmDiscard ?? ((message: string) => window.confirm(message))

  const header = document.createElement('header')
  header.className = 'header'
  const title = document.createElement('h1')
  title.textContent = 'MathsCross'
  const difficultyLabel = document.createElement('span')
  difficultyLabel.className = 'header__difficulty'
  header.append(title, difficultyLabel)

  const status = document.createElement('p')
  status.className = 'status'
  // The live region section 8.8 requires, so a screen reader user learns an
  // equation became correct without walking the grid to find out.
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const layout = document.createElement('div')
  layout.className = 'layout'

  const generating = document.createElement('div')
  generating.className = 'generating'
  generating.hidden = true
  const generatingText = document.createElement('span')
  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'button'
  cancelButton.textContent = 'Cancel'
  generating.append(generatingText, cancelButton)

  const footer = document.createElement('p')
  footer.className = 'status status--version'
  footer.textContent = `Version ${options.version}`

  const onboarding = createOnboardingView({
    onDismiss: () => {
      // Persisted in settings at M5. Until then it shows once per load, which is
      // the correct behaviour with nothing to remember it in.
      dismissed = true
    },
  })

  const menu = createMenuView({ onChoose: (difficulty) => newPuzzle(difficulty) })

  mount.append(header, menu.element, onboarding.element, generating, status, layout, footer)

  let dismissed = false
  let session: Session | null = null
  let pending: GenerateHandle | null = null
  let noticeTimer: number | null = null
  // Declared before the first `start()` call. `start` is hoisted; this is not, and
  // `announce` reads it during the initial mount.
  let lastAnnouncement = ''
  const client = options.client ?? new GenerateClient()

  // The first board is bundled, so a new player waits for nothing. Plan 5.8.
  start(starterGrid(), STARTER_DIFFICULTY, 'Starter puzzle')
  menu.setCurrent(STARTER_DIFFICULTY)
  if (!dismissed) {
    onboarding.show()
  }

  function start(puzzle: Grid, difficulty: Difficulty, label: string): void {
    session?.dispose()

    const state = createGameState(puzzle, difficulty)
    const timer = createTimer()
    timer.start()
    const detachVisibility = bindTimerToVisibility(timer)

    const board = createBoardView(state, {
      onSelect: (cell) => showPadFor(state, cell),
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
          showPadFor(state, cell)
          refresh()
        }
      },
      onRedo: () => {
        const cell = redo(state)
        if (cell !== null) {
          board.focus(cell)
          showPadFor(state, cell)
          refresh()
        }
      },
    })

    const tick = window.setInterval(() => controls.render(), CLOCK_TICK_MS)

    layout.replaceChildren(board.element, keypad.element, controls.element)
    difficultyLabel.textContent = label

    session = {
      state,
      board,
      keypad,
      controls,
      dispose: () => {
        window.clearInterval(tick)
        detachVisibility()
        timer.pause()
      },
    }

    const focused = board.focused
    if (focused !== null) {
      showPadFor(state, focused)
    } else {
      keypad.showFor(undefined, false)
    }
    refresh()

    function apply(cell: number, value: number): void {
      if (!isEditable(state, cell)) {
        return
      }
      if (enter(state, cell, value) === 'applied') {
        refresh()
      }
    }

    function showPadFor(current: GameState, cell: number): void {
      keypad.showFor(current.board.kinds[cell], isSignCell(current, cell))
    }

    function refresh(): void {
      board.render()
      controls.render()
      announce(board)
    }
  }

  /**
   * Starts a new puzzle, asking first if the current one is part-solved.
   *
   * An untouched board is discarded without a prompt: confirming something the
   * player has not invested anything in is friction for its own sake.
   */
  function newPuzzle(difficulty: Difficulty): void {
    if (pending !== null) {
      return
    }
    if (session !== null && hasProgress(session.state)) {
      const keep = confirmDiscard(
        'Start a new puzzle? The one you are working on will be lost.',
      )
      if (!keep) {
        return
      }
    }

    const seed = drawSeed()
    menu.setBusy(true)
    lastAnnouncement = ''

    // Only announce after a delay. Easy generates in single-digit milliseconds, so
    // flashing "generating" for one frame would be noise rather than information.
    noticeTimer = window.setTimeout(() => {
      generatingText.textContent = 'Making a puzzle…'
      generating.hidden = false
    }, GENERATING_NOTICE_MS)

    const handle = client.request(seed, difficulty, {
      onProgress: (attempt) => {
        generatingText.textContent = `Making a puzzle… (attempt ${attempt})`
      },
    })
    pending = handle

    void handle.puzzle.then((outcome) => {
      finishGenerating()

      if (!outcome.ok) {
        status.textContent =
          outcome.reason === 'cancelled'
            ? 'Cancelled. Your puzzle is untouched.'
            : 'Could not make a puzzle this time. Please try again.'
        lastAnnouncement = status.textContent
        return
      }

      start(outcome.puzzle.grid, difficulty, difficulty)
      menu.setCurrent(difficulty)
    })
  }

  cancelButton.addEventListener('click', () => {
    pending?.cancel()
  })

  function finishGenerating(): void {
    if (noticeTimer !== null) {
      window.clearTimeout(noticeTimer)
      noticeTimer = null
    }
    generating.hidden = true
    menu.setBusy(false)
    pending = null
  }

  /** Whether the player has entered anything worth protecting. */
  function hasProgress(state: GameState): boolean {
    const total = remainingCells(state).length
    const blanks = countBlanks(state)
    return total < blanks
  }

  function countBlanks(state: GameState): number {
    let blanks = 0
    for (let cell = 0; cell < state.puzzle.kinds.length; cell += 1) {
      if (isEditable(state, cell)) {
        blanks += 1
      }
    }
    return blanks
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
}
