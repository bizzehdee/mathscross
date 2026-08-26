/**
 * The playing screen. Plan sections 5.8, 7, 8.5, 8.6, 8.7 and 8.8.
 *
 * Owns the session and wires the board, keypad, controls, menu, onboarding card,
 * stats and generating state together. Everything it renders comes from
 * `GameState` and `boardStatus`; it computes no arithmetic of its own.
 */
import { type Difficulty } from '../engine/difficulty'
import { starterGrid, STARTER_DIFFICULTY } from '../engine/starter'
import { CellKind, type Grid } from '../engine/types'
import {
  dailyDateKey,
  dailyRequest,
  previousDateKey,
  ROLLOVER_NOTE,
} from '../features/daily/daily'
import { expireStreak, recordCompletion, recordDaily, type Stats } from '../features/stats/stats'
import { applyTheme, type ThemeChoice } from '../features/theme/theme'
import { drawSeed, GenerateClient, type GenerateHandle } from '../game/generate-client'
import {
  clearBoard,
  defaultStorage,
  loadBoard,
  loadSettings,
  loadStats,
  saveBoard,
  saveSettings,
  saveStats,
  type Settings,
  type Slot,
  type StorageLike,
} from '../game/persist'
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
import { bindTimerToVisibility, createTimer, type Timer } from '../game/timer'
import { createBoardView, type BoardView } from './board/board'
import { createControlsView } from './controls/controls'
import { createKeypadView } from './keypad/keypad'
import { createMenuView } from './menu/menu'
import { createOnboardingView } from './onboarding/onboarding'
import { createSettingsView } from './settings/settings-view'
import { createStatsView } from './stats/stats-view'

const GENERATING_NOTICE_MS = 150
const CLOCK_TICK_MS = 1000

export interface AppOptions {
  readonly version: string
  readonly client?: Pick<GenerateClient, 'request'>
  readonly confirmDiscard?: (message: string) => boolean
  readonly storage?: StorageLike
  /** Injected so tests can fix "today" rather than depending on the clock. */
  readonly now?: () => Date
  /** The element carrying `data-theme`. Defaults to the document root. */
  readonly themeRoot?: HTMLElement
}

interface Session {
  readonly slot: Slot
  readonly state: GameState
  readonly board: BoardView
  readonly timer: Timer
  readonly dateKey: string | null
  readonly dispose: () => void
  /** True once the completion has been counted, so it counts only once. */
  recorded: boolean
}

export function mountApp(mount: HTMLElement, options: AppOptions): void {
  mount.replaceChildren()

  const storage = options.storage ?? defaultStorage()
  const now = options.now ?? (() => new Date())
  const themeRoot = options.themeRoot ?? document.documentElement
  const confirmDiscard = options.confirmDiscard ?? ((message: string) => window.confirm(message))
  const client = options.client ?? new GenerateClient()

  let settings: Settings = loadSettings(storage)
  let stats: Stats = loadStats(storage)
  applyTheme(settings.theme, themeRoot)

  const header = document.createElement('header')
  header.className = 'header'
  const title = document.createElement('h1')
  title.textContent = 'MathsCross'
  const difficultyLabel = document.createElement('span')
  difficultyLabel.className = 'header__difficulty'
  header.append(title, difficultyLabel)

  const status = document.createElement('p')
  status.className = 'status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const updateBanner = document.createElement('div')
  updateBanner.className = 'banner'
  updateBanner.hidden = true

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
      settings = { ...settings, onboardingDismissed: true }
      saveSettings(settings, storage)
    },
  })

  const dailyButton = document.createElement('button')
  dailyButton.type = 'button'
  dailyButton.className = 'button'
  dailyButton.textContent = 'Daily'
  dailyButton.title = ROLLOVER_NOTE
  dailyButton.addEventListener('click', () => startDaily())

  const menu = createMenuView({ onChoose: (difficulty) => newPuzzle(difficulty) })
  menu.element.append(dailyButton)

  const statsView = createStatsView()
  const settingsView = createSettingsView({
    initial: settings.theme,
    onChoose: (theme) => setTheme(theme),
  })

  mount.append(
    header,
    menu.element,
    onboarding.element,
    updateBanner,
    generating,
    status,
    layout,
    statsView.element,
    settingsView.element,
    footer,
  )

  let session: Session | null = null
  let pending: GenerateHandle | null = null
  let noticeTimer: number | null = null
  let lastAnnouncement = ''

  // A lapsed streak is zeroed when the app opens, because nothing runs on the day
  // a player does not open it. Plan section 7.4.
  const today = now()
  stats = expireStreak(stats, dailyDateKey(today), previousDateKey(today))
  saveStats(stats, storage)

  resumeOrStart()
  statsView.render(stats)

  if (!settings.onboardingDismissed) {
    onboarding.show()
  }

  /**
   * Restores whatever was in progress, or falls back to the bundled board.
   *
   * Free play is preferred over the daily on load: it is the slot a player is most
   * likely to have been in, and the daily is one tap away.
   */
  function resumeOrStart(): void {
    const free = loadBoard('free', storage)
    if (free !== null) {
      start('free', free.puzzle, free.difficulty, free.difficulty, null, free)
      menu.setCurrent(free.difficulty)
      return
    }

    const daily = loadBoard('daily', storage)
    if (daily !== null && daily.dateKey === dailyDateKey(now())) {
      start('daily', daily.puzzle, daily.difficulty, 'Daily', daily.dateKey, daily)
      return
    }

    start('free', starterGrid(), STARTER_DIFFICULTY, 'Starter puzzle', null)
    menu.setCurrent(STARTER_DIFFICULTY)
  }

  function start(
    slot: Slot,
    puzzle: Grid,
    difficulty: Difficulty,
    label: string,
    dateKey: string | null,
    restored?: { board: Grid; elapsedMs: number; history: GameState['history']; historyIndex: number },
  ): void {
    session?.dispose()

    const state = createGameState(puzzle, difficulty)
    if (restored !== undefined) {
      state.board.values.set(restored.board.values)
      state.history = [...restored.history]
      state.historyIndex = restored.historyIndex
    }

    const timer = createTimer()
    timer.start()
    if (restored !== undefined) {
      timer.restore(restored.elapsedMs)
      timer.resume()
    }
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
      onUndo: () => move(undo(state)),
      onRedo: () => move(redo(state)),
    })

    const tick = window.setInterval(() => controls.render(), CLOCK_TICK_MS)

    layout.replaceChildren(board.element, keypad.element, controls.element)
    difficultyLabel.textContent = label

    session = {
      slot,
      state,
      board,
      timer,
      dateKey,
      recorded: false,
      dispose: () => {
        window.clearInterval(tick)
        detachVisibility()
        timer.pause()
      },
    }

    const focused = board.focused
    if (focused === null) {
      keypad.showFor(undefined, false)
    } else {
      showPadFor(state, focused)
    }
    refresh()

    function move(cell: number | null): void {
      if (cell === null) {
        return
      }
      board.focus(cell)
      showPadFor(state, cell)
      refresh()
    }

    function apply(cell: number, value: number): void {
      if (!isEditable(state, cell) || enter(state, cell, value) !== 'applied') {
        return
      }
      refresh()
    }

    function showPadFor(current: GameState, cell: number): void {
      keypad.showFor(current.board.kinds[cell], isSignCell(current, cell))
    }

    function refresh(): void {
      board.render()
      controls.render()
      announce(board)
      persist()
    }

    function persist(): void {
      const active = session
      if (active === null) {
        return
      }
      saveBoard(
        active.slot,
        state,
        timer.elapsed(),
        storage,
        active.dateKey === null ? undefined : active.dateKey,
      )

      if (board.status.board === 'solved' && !active.recorded) {
        active.recorded = true
        timer.pause()
        recordSolve(active)
      }
    }
  }

  /** Counts a completion once, and clears the slot so it is not resumed. */
  function recordSolve(active: Session): void {
    stats = recordCompletion(stats, active.state.difficulty, active.timer.elapsed())
    if (active.slot === 'daily' && active.dateKey !== null) {
      const date = now()
      stats = recordDaily(stats, active.dateKey, previousDateKey(date))
    }
    saveStats(stats, storage)
    statsView.render(stats)
    clearBoard(active.slot, storage)
  }

  function newPuzzle(difficulty: Difficulty): void {
    if (pending !== null || !confirmIfInProgress()) {
      return
    }
    request(drawSeed(), difficulty, 'free', difficulty, null)
  }

  /**
   * Starts or resumes today's daily.
   *
   * A daily already in the slot for today is resumed rather than regenerated, which
   * is what makes a player's daily immune to a later generator change. Plan 5.7.
   */
  function startDaily(): void {
    if (pending !== null) {
      return
    }
    const request_ = dailyRequest(now())
    const held = loadBoard('daily', storage)

    if (held !== null && held.dateKey === request_.dateKey) {
      if (!confirmIfInProgress()) {
        return
      }
      start('daily', held.puzzle, held.difficulty, 'Daily', held.dateKey, held)
      menu.setCurrent(null)
      return
    }

    // A daily from an earlier date has expired. Say so rather than letting a
    // half-finished board vanish without explanation. Plan section 7.4.
    if (held !== null && held.dateKey !== request_.dateKey) {
      clearBoard('daily', storage)
      status.textContent = 'Yesterday’s daily has expired. Here is today’s.'
      lastAnnouncement = status.textContent
    }

    if (!confirmIfInProgress()) {
      return
    }
    request(request_.seed, request_.difficulty, 'daily', 'Daily', request_.dateKey)
  }

  function confirmIfInProgress(): boolean {
    if (session === null) {
      return true
    }
    // A finished puzzle is not work in progress. Asking "the one you are working on
    // will be lost" after the player has solved it is both wrong and irritating,
    // and `recorded` is already the flag for "this one is done".
    if (session.recorded) {
      return true
    }
    if (!hasProgress(session.state)) {
      return true
    }
    return confirmDiscard('Start a new puzzle? The one you are working on will be lost.')
  }

  function request(
    seed: number,
    difficulty: Difficulty,
    slot: Slot,
    label: string,
    dateKey: string | null,
  ): void {
    menu.setBusy(true)
    lastAnnouncement = ''

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

      start(slot, outcome.puzzle.grid, difficulty, label, dateKey)
      menu.setCurrent(slot === 'free' ? difficulty : null)
    })
  }

  cancelButton.addEventListener('click', () => pending?.cancel())

  function finishGenerating(): void {
    if (noticeTimer !== null) {
      window.clearTimeout(noticeTimer)
      noticeTimer = null
    }
    generating.hidden = true
    menu.setBusy(false)
    pending = null
  }

  function setTheme(theme: ThemeChoice): void {
    settings = { ...settings, theme }
    saveSettings(settings, storage)
    applyTheme(theme, themeRoot)
  }

  function hasProgress(state: GameState): boolean {
    let blanks = 0
    for (let cell = 0; cell < state.puzzle.kinds.length; cell += 1) {
      if (isEditable(state, cell)) {
        blanks += 1
      }
    }
    return remainingCells(state).length < blanks
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

    if (message !== lastAnnouncement) {
      status.textContent = message
      lastAnnouncement = message
    }
  }

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

  /** Shows the update prompt. Exported behaviour, wired by `main.ts`. */
  Object.assign(mount, {
    mathscrossShowUpdate: (apply: () => Promise<void>): void => {
      updateBanner.replaceChildren()
      const text = document.createElement('span')
      text.textContent = 'A new version is ready.'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'button'
      button.textContent = 'Reload'
      button.addEventListener('click', () => void apply())
      updateBanner.append(text, button)
      updateBanner.hidden = false
    },
  })
}
