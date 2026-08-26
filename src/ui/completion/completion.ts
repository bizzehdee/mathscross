/**
 * The completion dialog.
 *
 * Finishing a puzzle is the moment the game exists for, and announcing it in a
 * status line is anticlimactic. This says so plainly, reports the time, and offers
 * the one thing a player who has just finished is most likely to want: another one
 * like it.
 *
 * "Another" means **the same difficulty**. Someone who has just finished a Medium
 * wants another Medium, not a menu asking them to choose again.
 *
 * A daily is different: there is one per day, so there is no "another" to offer.
 * That case reports the streak instead, which is the thing a daily is actually for.
 */
import type { Difficulty } from '../../engine/difficulty'
import { formatElapsed } from '../../game/timer'

export interface CompletionView {
  readonly element: HTMLElement
  /** Shows the dialog for a finished free-play puzzle. */
  showForPuzzle(difficulty: Difficulty, elapsedMs: number): void
  /** Shows the dialog for a finished daily, reporting the streak. */
  showForDaily(elapsedMs: number, currentStreak: number): void
  hide(): void
  readonly visible: boolean
}

export interface CompletionCallbacks {
  /** Another puzzle of the difficulty just finished. */
  readonly onAnother: (difficulty: Difficulty) => void
  readonly onMenu: () => void
}

const LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export function createCompletionView(callbacks: CompletionCallbacks): CompletionView {
  const element = document.createElement('div')
  element.className = 'completion'
  element.hidden = true
  // A real modal: it appears over the finished board, and there is nothing useful
  // to do behind it until the player chooses.
  element.setAttribute('role', 'dialog')
  element.setAttribute('aria-modal', 'true')
  element.setAttribute('aria-labelledby', 'completion-title')

  const panel = document.createElement('div')
  panel.className = 'completion__panel'

  const heading = document.createElement('h2')
  heading.id = 'completion-title'
  heading.className = 'completion__title'

  const detail = document.createElement('p')
  detail.className = 'completion__detail'

  const actions = document.createElement('div')
  actions.className = 'completion__actions'

  const another = document.createElement('button')
  another.type = 'button'
  another.className = 'button button--primary'

  const menu = document.createElement('button')
  menu.type = 'button'
  menu.className = 'button'
  menu.textContent = 'Back to menu'
  menu.addEventListener('click', () => callbacks.onMenu())

  actions.append(another, menu)
  panel.append(heading, detail, actions)
  element.append(panel)

  let finished: Difficulty | null = null

  another.addEventListener('click', () => {
    if (finished !== null) {
      callbacks.onAnother(finished)
    }
  })

  // Escape means "I am done here", which is the menu rather than another puzzle.
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      callbacks.onMenu()
    }
  })

  function show(title: string, text: string): void {
    heading.textContent = title
    detail.textContent = text
    element.hidden = false
    // Focus the primary action, so a keyboard or screen reader user lands on the
    // thing they most likely want rather than having to hunt for it.
    ;(another.hidden ? menu : another).focus()
  }

  return {
    element,
    showForPuzzle(difficulty, elapsedMs): void {
      finished = difficulty
      another.hidden = false
      another.textContent = `Another ${LABELS[difficulty]}`
      another.setAttribute('aria-label', `Start another ${LABELS[difficulty]} puzzle`)
      show('Congratulations, you did it!', `Solved in ${formatElapsed(elapsedMs)}.`)
    },
    showForDaily(elapsedMs, currentStreak): void {
      // No "another": there is one daily a day, and offering a second would
      // promise something the game cannot give.
      finished = null
      another.hidden = true
      const streak =
        currentStreak > 1
          ? ` That is ${currentStreak} days in a row.`
          : ' Come back tomorrow for the next one.'
      show(
        'Congratulations, you did it!',
        `Today’s daily, solved in ${formatElapsed(elapsedMs)}.${streak}`,
      )
    },
    hide(): void {
      element.hidden = true
    },
    get visible(): boolean {
      return !element.hidden
    },
  }
}
