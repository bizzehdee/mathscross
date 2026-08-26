/**
 * Undo, redo and the timer display. Plan section 8.6.
 */
import { formatElapsed, type Timer } from '../../game/timer'
import { canRedo, canUndo, type GameState } from '../../game/state'

export interface ControlsView {
  readonly element: HTMLElement
  /** Refreshes button availability and the clock. */
  render(): void
}

export interface ControlsCallbacks {
  readonly onUndo: () => void
  readonly onRedo: () => void
}

export function createControlsView(
  state: GameState,
  timer: Timer,
  callbacks: ControlsCallbacks,
): ControlsView {
  const element = document.createElement('div')
  element.className = 'controls'

  const undoButton = document.createElement('button')
  undoButton.type = 'button'
  undoButton.className = 'button'
  undoButton.textContent = 'Undo'
  undoButton.addEventListener('click', callbacks.onUndo)

  const redoButton = document.createElement('button')
  redoButton.type = 'button'
  redoButton.className = 'button'
  redoButton.textContent = 'Redo'
  redoButton.addEventListener('click', callbacks.onRedo)

  const clock = document.createElement('span')
  clock.className = 'controls__timer'
  // Announced politely rather than assertively: a clock updating every second
  // would otherwise interrupt a screen reader continuously.
  clock.setAttribute('aria-live', 'off')

  element.append(undoButton, redoButton, clock)

  function render(): void {
    undoButton.disabled = !canUndo(state)
    redoButton.disabled = !canRedo(state)
    clock.textContent = formatElapsed(timer.elapsed())
  }

  render()
  return { element, render }
}
