/**
 * The first-run explainer. Plan section 8.7.
 *
 * Its subject is multi-cell numbers, and only that. A player who reads `1 5` as
 * two operands rather than fifteen will enter correct-looking answers, watch them
 * be rejected, and reasonably conclude the game is broken. That applies from the
 * first Medium board and is the one thing about MathsCross genuinely worth
 * explaining.
 *
 * Arithmetic is deliberately **not** explained. The game uses ordinary BODMAS, so
 * there is nothing to teach — and saying that the normal rules apply implies they
 * might not have, which invites a player to hunt for a catch that does not exist.
 */
export interface OnboardingView {
  readonly element: HTMLElement
  show(): void
  hide(): void
  readonly visible: boolean
}

export interface OnboardingCallbacks {
  /** Called when the player dismisses it, so the choice can be persisted. */
  readonly onDismiss: () => void
}

export function createOnboardingView(callbacks: OnboardingCallbacks): OnboardingView {
  const element = document.createElement('div')
  element.className = 'onboarding'
  element.hidden = true
  element.setAttribute('role', 'dialog')
  element.setAttribute('aria-modal', 'false')
  element.setAttribute('aria-labelledby', 'onboarding-title')

  const title = document.createElement('h2')
  title.id = 'onboarding-title'
  title.textContent = 'Numbers span cells'

  const body = document.createElement('p')
  body.textContent =
    'Digits next to each other make one number. Two cells holding 1 and 5 read as fifteen, not as one and five. Grouped cells are drawn joined together so you can see which digits belong to the same number.'

  const example = document.createElement('p')
  example.className = 'onboarding__example'
  example.textContent = '1 5 + 3 = 1 8   reads as   15 + 3 = 18'

  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.className = 'button'
  dismiss.textContent = 'Got it'
  // Does not hide itself. It is a screen now, and the router decides what shows,
  // so hiding here would leave the router pointing at an empty screen.
  dismiss.addEventListener('click', () => callbacks.onDismiss())

  element.append(title, body, example, dismiss)

  function show(): void {
    element.hidden = false
    dismiss.focus()
  }

  function hide(): void {
    element.hidden = true
  }

  return {
    element,
    show,
    hide,
    get visible(): boolean {
      return !element.hidden
    },
  }
}
