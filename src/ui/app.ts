/**
 * The application shell: screens, and the session that moves between them.
 * Plan sections 3, 5.8, 7, 8.5, 8.6, 8.7 and 8.8.
 *
 * Five screens, one at a time. The app opens on **home** rather than dropping
 * straight into a board: a player arriving wants to choose what to do, and a board
 * that appears unbidden answers a question nobody asked. Statistics, settings and
 * the how-to-play card are screens of their own rather than panels stacked under
 * the board, so no screen has to hold everything at once.
 */
import { type Difficulty } from '../engine/difficulty'
import { CellKind, EMPTY, type Grid } from '../engine/types'
import { dailyDateKey, dailyRequest, previousDateKey } from '../features/daily/daily'
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
  type LoadedBoard,
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
  undo,
  type GameState,
} from '../game/state'
import { bindTimerToVisibility, createTimer, type Clock, type Timer } from '../game/timer'
import { createBoardView, type BoardView } from './board/board'
import { createCompletionView } from './completion/completion'
import { createControlsView } from './controls/controls'
import { createHomeView, type ResumeSummary } from './home/home'
import { createKeypadView } from './keypad/keypad'
import { createOnboardingView } from './onboarding/onboarding'
import { createRouter, type Screen } from './router'
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
  /**
   * The millisecond clock the play timer reads.
   *
   * Injected for the same reason `now` is: a test that has to wait for real time
   * to pass cannot assert anything about elapsed time, so it asserts nothing and
   * the timer's interaction with saving and navigation goes uncovered.
   */
  readonly clock?: Clock
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
  /** Stops the clock and writes the elapsed total down. Safe to call twice. */
  readonly suspend: () => void
  /** Restarts the clock on returning to the board. Safe to call twice. */
  readonly activate: () => void
  recorded: boolean
}

export function mountApp(mount: HTMLElement, options: AppOptions): void {
  mount.replaceChildren()

  const storage = options.storage ?? defaultStorage()
  const now = options.now ?? (() => new Date())
  const themeRoot = options.themeRoot ?? document.documentElement
  const confirmDiscard = options.confirmDiscard ?? ((message: string) => window.confirm(message))
  const client = options.client ?? new GenerateClient()
  const router = createRouter('home')

  let settings: Settings = loadSettings(storage)
  let stats: Stats = loadStats(storage)
  applyTheme(settings.theme, themeRoot)

  // ---- chrome ----------------------------------------------------------------

  const header = document.createElement('header')
  header.className = 'header'

  const backButton = document.createElement('button')
  backButton.type = 'button'
  backButton.className = 'button header__back'
  backButton.textContent = 'Menu'
  backButton.setAttribute('aria-label', 'Back to the menu')
  backButton.addEventListener('click', () => leaveScreen())

  const title = document.createElement('h1')
  title.textContent = 'MathsCross'
  const subtitle = document.createElement('span')
  subtitle.className = 'header__difficulty'
  header.append(backButton, title, subtitle)

  const status = document.createElement('p')
  status.className = 'status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const updateBanner = document.createElement('div')
  updateBanner.className = 'banner'
  updateBanner.hidden = true

  const generating = document.createElement('div')
  generating.className = 'generating'
  generating.hidden = true
  const generatingText = document.createElement('span')
  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'button'
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', () => pending?.cancel())
  generating.append(generatingText, cancelButton)

  const footer = document.createElement('p')
  footer.className = 'status status--version'
  footer.textContent = `Version ${options.version}`

  // ---- screens ---------------------------------------------------------------

  const home = createHomeView({
    onContinue: (slot) => resume(slot),
    onNew: (difficulty) => newPuzzle(difficulty),
    onDaily: () => startDaily(),
    onStats: () => router.go('stats'),
    onSettings: () => router.go('settings'),
    onHowToPlay: () => router.go('howtoplay'),
  })

  const gameScreen = document.createElement('section')
  gameScreen.className = 'screen screen--game'
  const layout = document.createElement('div')
  layout.className = 'layout'

  const completion = createCompletionView({
    onAnother: (difficulty) => {
      completion.hide()
      newPuzzle(difficulty)
    },
    onMenu: () => {
      completion.hide()
      leaveScreen()
    },
  })

  gameScreen.append(layout, completion.element)

  const statsScreen = document.createElement('section')
  statsScreen.className = 'screen screen--stats'
  const statsView = createStatsView()
  statsScreen.append(sectionHeading('Statistics'), statsView.element)

  const settingsScreen = document.createElement('section')
  settingsScreen.className = 'screen screen--settings'
  const settingsView = createSettingsView({
    initial: settings.theme,
    onChoose: (theme) => setTheme(theme),
  })
  settingsScreen.append(sectionHeading('Settings'), settingsView.element)

  const howToPlayScreen = document.createElement('section')
  howToPlayScreen.className = 'screen screen--howtoplay'
  const onboarding = createOnboardingView({
    onDismiss: () => {
      settings = { ...settings, onboardingDismissed: true }
      saveSettings(settings, storage)
      router.reset('home')
    },
  })
  howToPlayScreen.append(onboarding.element)

  const screens: Readonly<Record<Screen, HTMLElement>> = {
    home: home.element,
    game: gameScreen,
    stats: statsScreen,
    settings: settingsScreen,
    howtoplay: howToPlayScreen,
  }

  mount.append(header, updateBanner, generating, status, ...Object.values(screens), footer)

  // ---- state -----------------------------------------------------------------

  let session: Session | null = null
  let pending: GenerateHandle | null = null
  let noticeTimer: number | null = null
  let lastAnnouncement = ''

  router.onChange((screen) => {
    showScreen(screen)
    // A board nobody is looking at is not being played. Without this the clock
    // ran on the menu, and — because the elapsed total was only written on a
    // move — resuming restored the time of the last entry rather than the time
    // the player actually left, so walking away quietly discounted the clock.
    //
    // Both directions, not just the suspend: `start` resets to home before going
    // to the game, so a new session is suspended on its way past and would stay
    // stopped for the whole board without the matching activate.
    if (screen === 'game') {
      session?.activate()
    } else {
      session?.suspend()
    }
  })

  // A lapsed streak is zeroed when the app opens, because nothing runs on the day
  // a player does not open it. Plan section 7.4.
  const opened = now()
  stats = expireStreak(stats, dailyDateKey(opened), previousDateKey(opened))
  saveStats(stats, storage)

  // A first-time player is taken to the how-to-play screen rather than having a
  // card appear over the menu. Everyone else lands on home.
  if (settings.onboardingDismissed) {
    router.reset('home')
    showScreen('home')
  } else {
    router.reset('howtoplay')
    showScreen('howtoplay')
  }

  // ---- screen plumbing -------------------------------------------------------

  function showScreen(screen: Screen): void {
    for (const [name, element] of Object.entries(screens)) {
      element.hidden = name !== screen
    }
    // Only screens above home need a way back, and only the game screen has
    // per-move status worth announcing.
    backButton.hidden = screen === 'home'
    status.hidden = screen !== 'game'
    if (screen !== 'game') {
      subtitle.textContent = ''
    }
    if (screen === 'home') {
      refreshHome()
    }
    if (screen === 'stats') {
      statsView.render(stats)
    }
    // The card is the whole of this screen, and it starts hidden so that a
    // returning player does not see it flash past on the way to home. Showing it
    // here rather than only at mount: a player who has dismissed it once and
    // then chooses "How to play" from the menu got the screen with nothing on it,
    // because the only call to show it was the first-run branch below.
    if (screen === 'howtoplay') {
      onboarding.show()
    }
  }

  /**
   * Leaves the current screen.
   *
   * A game is left rather than abandoned: walking away and coming back is the
   * same as never leaving. Entries are saved as they are made, and the router
   * stops the clock and records the elapsed total on the way out — an earlier
   * version relied on the entries alone, which meant the time between the last
   * entry and leaving was thrown away.
   */
  function leaveScreen(): void {
    completion.hide()
    if (!router.back()) {
      router.reset('home')
      showScreen('home')
    }
  }

  function refreshHome(): void {
    const free = loadBoard('free', storage)
    const daily = loadBoard('daily', storage)
    const todayKey = dailyDateKey(now())

    home.setResume(
      free === null ? null : summarise(free, free.difficulty),
      daily === null || daily.dateKey !== todayKey ? null : summarise(daily, 'daily'),
    )

    const { currentStreak } = stats.daily
    home.setStreak(
      currentStreak > 0
        ? `Daily streak: ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}.`
        : null,
    )
  }

  function summarise(board: LoadedBoard, label: string): ResumeSummary {
    return { label, elapsedMs: board.elapsedMs, remaining: countBlanks(board, true) }
  }

  /** Blanks in a stored board: all of them, or only those still unfilled. */
  function countBlanks(board: LoadedBoard, unfilledOnly: boolean): number {
    let count = 0
    for (let cell = 0; cell < board.puzzle.kinds.length; cell += 1) {
      const kind = board.puzzle.kinds[cell]
      const editable =
        (kind === CellKind.Digit || kind === CellKind.Operator) &&
        board.puzzle.values[cell] === EMPTY
      if (!editable) {
        continue
      }
      if (!unfilledOnly || board.board.values[cell] === EMPTY) {
        count += 1
      }
    }
    return count
  }

  // ---- sessions --------------------------------------------------------------

  function resume(slot: Slot): void {
    const held = loadBoard(slot, storage)
    if (held === null) {
      refreshHome()
      return
    }
    if (slot === 'daily' && held.dateKey !== dailyDateKey(now())) {
      // Expired overnight. Say so rather than letting it vanish. Plan 7.4.
      clearBoard('daily', storage)
      refreshHome()
      status.hidden = false
      status.textContent = 'That daily has expired. Start today’s from the menu.'
      return
    }
    start(
      slot,
      held.puzzle,
      held.difficulty,
      slot === 'daily' ? 'Daily' : held.difficulty,
      held.dateKey,
      held,
    )
  }

  function start(
    slot: Slot,
    puzzle: Grid,
    difficulty: Difficulty,
    label: string,
    dateKey: string | null,
    restored?: LoadedBoard,
  ): void {
    session?.dispose()
    completion.hide()

    const state = createGameState(puzzle, difficulty)
    if (restored !== undefined) {
      state.board.values.set(restored.board.values)
      state.history = [...restored.history]
      state.historyIndex = restored.historyIndex
    }

    const timer = createTimer(options.clock)
    timer.start()
    if (restored !== undefined) {
      timer.restore(restored.elapsedMs)
      timer.resume()
    }
    // `persist` as the pause callback: a hidden tab, a locked phone and a closing
    // page all stop the clock, and each one has to write down where it stopped.
    const detachVisibility = bindTimerToVisibility(timer, document, () => persist())

    const board = createBoardView(state, {
      onSelect: (cell) => showPadFor(cell),
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

    session = {
      slot,
      state,
      board,
      timer,
      dateKey,
      recorded: false,
      suspend: () => {
        if (!timer.running) {
          return
        }
        timer.pause()
        persist()
      },
      activate: () => {
        // Not a solved board: its time is already final and recorded, and
        // restarting the clock on it would report a longer solve than the one
        // that was banked.
        if (timer.running || document.hidden || board.status.board === 'solved') {
          return
        }
        timer.resume()
      },
      dispose: () => {
        window.clearInterval(tick)
        detachVisibility()
        // Recorded before the timer is discarded, so replacing a session does not
        // throw away the time the outgoing board had run since its last entry.
        timer.pause()
        persist()
      },
    }

    // Home stays under the game, so leaving the board returns to the menu rather
    // than to whatever screen launched it.
    router.reset('home')
    router.go('game')
    showScreen('game')

    // After navigating, not before: the reset above shows home on its way past,
    // and `showScreen` clears the subtitle for every screen that is not the game.
    subtitle.textContent = label

    const focused = board.focused
    if (focused === null) {
      keypad.showFor(undefined, false)
    } else {
      showPadFor(focused)
    }
    refresh()

    function move(cell: number | null): void {
      if (cell === null) {
        return
      }
      board.focus(cell)
      showPadFor(cell)
      refresh()
    }

    function apply(cell: number, value: number): void {
      if (!isEditable(state, cell) || enter(state, cell, value) !== 'applied') {
        return
      }
      refresh()
    }

    function showPadFor(cell: number): void {
      keypad.showFor(state.board.kinds[cell], isSignCell(state, cell))
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
        celebrate(active)
      }
    }
  }

  /** Counts a completion once, and clears the slot so it is not resumed. */
  function recordSolve(active: Session): void {
    stats = recordCompletion(stats, active.state.difficulty, active.timer.elapsed())
    if (active.slot === 'daily' && active.dateKey !== null) {
      stats = recordDaily(stats, active.dateKey, previousDateKey(now()))
    }
    saveStats(stats, storage)
    statsView.render(stats)
    clearBoard(active.slot, storage)
  }

  /**
   * Says so, and offers another.
   *
   * Finishing is the moment the game exists for, and a line of status text is an
   * anticlimax. A daily gets the streak instead of an "another", because there is
   * one a day and offering a second would promise what the game cannot give.
   */
  function celebrate(active: Session): void {
    if (active.slot === 'daily') {
      completion.showForDaily(active.timer.elapsed(), stats.daily.currentStreak)
      return
    }
    completion.showForPuzzle(active.state.difficulty, active.timer.elapsed())
  }

  // ---- generation ------------------------------------------------------------

  function newPuzzle(difficulty: Difficulty): void {
    if (pending !== null || !confirmIfInProgress('free')) {
      return
    }
    request(drawSeed(), difficulty, 'free', difficulty, null)
  }

  function startDaily(): void {
    if (pending !== null) {
      return
    }
    const wanted = dailyRequest(now())
    const held = loadBoard('daily', storage)

    // Today's daily is resumed rather than regenerated. That is what makes a
    // player's daily immune to a later generator change. Plan section 5.7.
    if (held !== null && held.dateKey === wanted.dateKey) {
      resume('daily')
      return
    }

    if (held !== null) {
      clearBoard('daily', storage)
    }
    request(wanted.seed, wanted.difficulty, 'daily', 'Daily', wanted.dateKey)
  }

  /**
   * Asks before replacing a board in the slot about to be written.
   *
   * Only that slot: starting free play must never prompt about the daily, because
   * it does not touch it. A finished puzzle is not work in progress, and neither is
   * an untouched one — confirming either is friction for its own sake.
   */
  function confirmIfInProgress(slot: Slot): boolean {
    const held = loadBoard(slot, storage)
    if (held === null) {
      return true
    }
    if (session !== null && session.slot === slot && session.recorded) {
      return true
    }
    if (countBlanks(held, true) >= countBlanks(held, false)) {
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
    home.setBusy(true)
    lastAnnouncement = ''

    // Only announce after a delay. Easy generates in single-digit milliseconds, so
    // flashing a notice for one frame would be noise rather than information.
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
        status.hidden = false
        status.textContent =
          outcome.reason === 'cancelled'
            ? 'Cancelled. Nothing was changed.'
            : 'Could not make a puzzle this time. Please try again.'
        lastAnnouncement = status.textContent
        return
      }

      start(slot, outcome.puzzle.grid, difficulty, label, dateKey)
    })
  }

  function finishGenerating(): void {
    if (noticeTimer !== null) {
      window.clearTimeout(noticeTimer)
      noticeTimer = null
    }
    generating.hidden = true
    home.setBusy(false)
    pending = null
  }

  // ---- odds and ends ---------------------------------------------------------

  function setTheme(theme: ThemeChoice): void {
    settings = { ...settings, theme }
    saveSettings(settings, storage)
    applyTheme(theme, themeRoot)
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

  function sectionHeading(text: string): HTMLElement {
    const element = document.createElement('h2')
    element.className = 'screen__heading'
    element.textContent = text
    return element
  }

  /**
   * Hooks the shell drives from outside.
   *
   * `mathscrossBack` is what the Android hardware back button calls: back must
   * leave the current screen and exit the app only from home. Plan section 8.6.
   */
  Object.assign(mount, {
    mathscrossBack: (): boolean => {
      if (router.current === 'home') {
        return false
      }
      leaveScreen()
      return true
    },
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
