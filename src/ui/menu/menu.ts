/**
 * Difficulty selection. Plan section 8.6.
 *
 * Deliberately plain: three buttons and a confirmation before discarding work.
 * There is one free-play slot, so starting a new puzzle replaces the current one,
 * and losing a half-finished board to a mis-tap would be the game's most annoying
 * possible bug.
 */
import { ALL_DIFFICULTIES, type Difficulty } from '../../engine/difficulty'

export interface MenuView {
  readonly element: HTMLElement
  /** Marks which difficulty is in play. */
  setCurrent(difficulty: Difficulty | null): void
  /** Disables the buttons while a puzzle is being generated. */
  setBusy(busy: boolean): void
}

export interface MenuCallbacks {
  readonly onChoose: (difficulty: Difficulty) => void
}

const LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** What each difficulty actually asks of the player, for the button's title. */
const DESCRIPTIONS: Readonly<Record<Difficulty, string>> = {
  easy: '5 by 5, single digits, plus and minus',
  medium: '7 by 7, two-digit numbers, some operators hidden',
  hard: '9 by 9, three-digit numbers, division, every operator hidden',
}

export function createMenuView(callbacks: MenuCallbacks): MenuView {
  const element = document.createElement('div')
  element.className = 'menu'
  element.setAttribute('role', 'group')
  element.setAttribute('aria-label', 'New puzzle')

  const buttons = new Map<Difficulty, HTMLButtonElement>()

  for (const difficulty of ALL_DIFFICULTIES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button'
    // Selectable without matching on label text, which the Daily button shares a
    // container with.
    button.setAttribute('data-difficulty', difficulty)
    button.textContent = LABELS[difficulty]
    button.title = DESCRIPTIONS[difficulty]
    button.setAttribute('aria-label', `New ${LABELS[difficulty]} puzzle: ${DESCRIPTIONS[difficulty]}`)
    button.addEventListener('click', () => callbacks.onChoose(difficulty))
    buttons.set(difficulty, button)
    element.append(button)
  }

  return {
    element,
    setCurrent(difficulty): void {
      for (const [key, button] of buttons) {
        button.setAttribute('data-active', key === difficulty ? 'true' : 'false')
        // aria-pressed, not aria-current: these are toggles reporting which
        // difficulty is in play, not links to a location.
        button.setAttribute('aria-pressed', key === difficulty ? 'true' : 'false')
      }
    },
    setBusy(busy): void {
      for (const [, button] of buttons) {
        button.disabled = busy
      }
    },
  }
}
