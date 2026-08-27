/**
 * The start screen.
 *
 * The app opens here rather than dropping straight into a board. A player arriving
 * wants to choose what to do — carry on, start something new, look at their
 * statistics — and a board that appears unbidden answers a question nobody asked.
 *
 * It is also the only screen that needs to exist for the app to be usable, so it
 * carries the primary actions and nothing else: continue, new puzzle, daily, and
 * the way to the other screens.
 */
import { ALL_DIFFICULTIES, type Difficulty } from '../../engine/difficulty'
import { formatElapsed } from '../../game/timer'
import { ROLLOVER_NOTE } from '../../features/daily/daily'

const LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
}

/** What each difficulty asks of the player, so a choice is informed. */
const DESCRIPTIONS: Readonly<Record<Difficulty, string>> = {
  easy: '5 by 5, single digits, plus and minus, always solvable by logic',
  medium: '7 by 7, two-digit numbers, times as well, always solvable by logic',
  hard: '7 by 7, negative numbers, some operators hidden',
  extreme: '9 by 9, three-digit numbers, division, every operator hidden',
}

export interface ResumeSummary {
  readonly label: string
  readonly elapsedMs: number
  readonly remaining: number
}

export interface HomeView {
  readonly element: HTMLElement
  /** Shows or hides the continue button, with what it would resume. */
  setResume(free: ResumeSummary | null, daily: ResumeSummary | null): void
  setBusy(busy: boolean): void
  /** Streak line, or null to hide it. */
  setStreak(text: string | null): void
}

export interface HomeCallbacks {
  readonly onContinue: (slot: 'free' | 'daily') => void
  readonly onNew: (difficulty: Difficulty) => void
  readonly onDaily: () => void
  readonly onStats: () => void
  readonly onSettings: () => void
  readonly onHowToPlay: () => void
}

export function createHomeView(callbacks: HomeCallbacks): HomeView {
  const element = document.createElement('section')
  element.className = 'screen screen--home'

  const streak = document.createElement('p')
  streak.className = 'home__streak'
  streak.hidden = true

  const resumeGroup = document.createElement('div')
  resumeGroup.className = 'home__group'
  resumeGroup.setAttribute('role', 'group')
  resumeGroup.setAttribute('aria-label', 'Continue')
  resumeGroup.hidden = true

  const continueFree = action('Continue', () => callbacks.onContinue('free'))
  continueFree.classList.add('button--primary')
  const continueDaily = action('Continue daily', () => callbacks.onContinue('daily'))
  continueDaily.classList.add('button--primary')
  resumeGroup.append(continueFree, continueDaily)

  const newHeading = heading('New puzzle')
  const newGroup = document.createElement('div')
  newGroup.className = 'home__group'
  newGroup.setAttribute('role', 'group')
  newGroup.setAttribute('aria-label', 'New puzzle')

  const difficultyButtons: HTMLButtonElement[] = []
  for (const difficulty of ALL_DIFFICULTIES) {
    const button = action(LABELS[difficulty], () => callbacks.onNew(difficulty))
    button.setAttribute('data-difficulty', difficulty)
    button.title = DESCRIPTIONS[difficulty]
    button.setAttribute(
      'aria-label',
      `New ${LABELS[difficulty]} puzzle: ${DESCRIPTIONS[difficulty]}`,
    )
    difficultyButtons.push(button)
    newGroup.append(button)
  }

  const daily = action('Daily', () => callbacks.onDaily())
  daily.title = ROLLOVER_NOTE
  // An explicit name, because a `title` can otherwise become the accessible name
  // and announce the whole rollover note where "Daily" was wanted.
  daily.setAttribute('aria-label', 'Daily puzzle')
  daily.setAttribute('aria-description', ROLLOVER_NOTE)
  daily.setAttribute('data-daily', 'true')
  newGroup.append(daily)

  const moreGroup = document.createElement('nav')
  moreGroup.className = 'home__group home__group--nav'
  moreGroup.setAttribute('aria-label', 'More')
  moreGroup.append(
    action('Statistics', () => callbacks.onStats()),
    action('Settings', () => callbacks.onSettings()),
    action('How to play', () => callbacks.onHowToPlay()),
  )

  element.append(streak, resumeGroup, newHeading, newGroup, moreGroup)

  return {
    element,
    setResume(free, dailyResume): void {
      continueFree.hidden = free === null
      continueDaily.hidden = dailyResume === null
      resumeGroup.hidden = free === null && dailyResume === null

      if (free !== null) {
        continueFree.textContent = `Continue ${free.label}`
        continueFree.setAttribute('aria-label', describe('Continue', free))
      }
      if (dailyResume !== null) {
        continueDaily.textContent = 'Continue daily'
        continueDaily.setAttribute('aria-label', describe('Continue daily', dailyResume))
      }
    },
    setBusy(busy): void {
      for (const button of [...difficultyButtons, daily, continueFree, continueDaily]) {
        button.disabled = busy
      }
    },
    setStreak(text): void {
      streak.hidden = text === null
      streak.textContent = text ?? ''
    },
  }
}

/** "Continue easy, 2:15 played, 4 cells left" — the label a screen reader hears. */
function describe(prefix: string, summary: ResumeSummary): string {
  const cells = summary.remaining === 1 ? '1 cell left' : `${summary.remaining} cells left`
  return `${prefix} ${summary.label}, ${formatElapsed(summary.elapsedMs)} played, ${cells}`
}

function action(label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'button'
  button.textContent = label
  button.addEventListener('click', onPress)
  return button
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h2')
  element.className = 'screen__heading'
  element.textContent = text
  return element
}
