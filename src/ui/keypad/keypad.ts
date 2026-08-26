/**
 * Entry pads. Plan section 8.6.
 *
 * Two pads, because a masked cell is one of two kinds. Which one shows follows
 * the focused cell, so a digit cell never offers operators and an operator cell
 * never offers digits — the player cannot enter something the cell cannot hold.
 *
 * The native soft keyboard is deliberately not used. It resizes the viewport and
 * obscures the board, which on a phone means the thing you are typing into
 * disappears as you type.
 */
import { parametersFor, type Difficulty } from '../../engine/difficulty'
import { CellKind, EMPTY, operatorToGlyph, type Operator } from '../../engine/types'

export interface KeypadView {
  readonly element: HTMLElement
  /** Shows the pad matching a cell's kind, or hides both when nothing is focused. */
  showFor(kind: number | undefined, signOnly: boolean): void
}

export interface KeypadCallbacks {
  readonly onValue: (value: number) => void
  readonly onClear: () => void
}

export function createKeypadView(
  difficulty: Difficulty,
  callbacks: KeypadCallbacks,
): KeypadView {
  const parameters = parametersFor(difficulty)
  const element = document.createElement('div')
  element.className = 'keypad'

  const digits = document.createElement('div')
  digits.className = 'keypad__pad keypad__pad--digits'
  digits.setAttribute('role', 'group')
  digits.setAttribute('aria-label', 'Digits')
  for (let digit = 0; digit <= 9; digit += 1) {
    digits.append(key(String(digit), `Digit ${digit}`, () => callbacks.onValue(digit)))
  }

  const operators = document.createElement('div')
  operators.className = 'keypad__pad keypad__pad--operators'
  operators.setAttribute('role', 'group')
  operators.setAttribute('aria-label', 'Operators')
  const operatorKeys = new Map<Operator, HTMLButtonElement>()
  for (const operator of parameters.operators) {
    const button = key(operatorToGlyph(operator), operatorLabel(operator), () =>
      callbacks.onValue(operator),
    )
    operatorKeys.set(operator, button)
    operators.append(button)
  }

  // A word, not the erase-to-the-left glyph. U+232B has no coverage in the
  // default Android or Windows UI font and renders as a tofu box, which reads as
  // a broken app rather than a button.
  const clear = key('Clear', 'Clear cell', () => callbacks.onClear())
  clear.classList.add('keypad__clear')

  element.append(digits, operators, clear)

  return {
    element,
    showFor(kind, signOnly): void {
      const showDigits = kind === CellKind.Digit
      const showOperators = kind === CellKind.Operator
      digits.hidden = !showDigits
      operators.hidden = !showOperators
      clear.hidden = !showDigits && !showOperators

      // A sign position admits only minus: a unary plus carries no meaning, so
      // offering the other operators there would invite an entry that can never
      // be right. Plan section 2.3.
      for (const [operator, button] of operatorKeys) {
        button.hidden = signOnly && operator !== 1
      }
    },
  }
}

function key(glyph: string, label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'button keypad__key'
  button.textContent = glyph
  button.setAttribute('aria-label', label)
  button.addEventListener('click', onPress)
  return button
}

function operatorLabel(operator: Operator): string {
  switch (operator) {
    case 0:
      return 'Plus'
    case 1:
      return 'Minus'
    case 2:
      return 'Times'
    default:
      return 'Divided by'
  }
}

/** The value a cleared cell holds. Exported so callers need not import EMPTY. */
export const CLEARED = EMPTY
