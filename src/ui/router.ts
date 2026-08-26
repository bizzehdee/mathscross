/**
 * Which screen is showing. Plan section 3.
 *
 * Deliberately not a URL router. The app is one page with no shareable locations,
 * and a real router would add history entries a player would then have to navigate
 * back through — on Android the hardware back button already means "leave this
 * screen", which this handles directly.
 *
 * A stack rather than a single value, so the back button always has somewhere to
 * go and never has to guess. `home` is the floor and cannot be popped.
 */
export type Screen = 'home' | 'game' | 'stats' | 'settings' | 'howtoplay'

export interface Router {
  readonly current: Screen
  /** Shows a screen, remembering where to come back to. */
  go(screen: Screen): void
  /** Returns to the previous screen. False when already at the floor. */
  back(): boolean
  /** Replaces the stack with a single screen. */
  reset(screen: Screen): void
  onChange(listener: (screen: Screen) => void): void
}

export function createRouter(initial: Screen = 'home'): Router {
  let stack: Screen[] = [initial]
  const listeners: ((screen: Screen) => void)[] = []

  const current = (): Screen => stack[stack.length - 1] ?? 'home'
  const notify = (): void => {
    for (const listener of listeners) {
      listener(current())
    }
  }

  return {
    get current(): Screen {
      return current()
    },
    go(screen): void {
      if (current() === screen) {
        return
      }
      stack.push(screen)
      notify()
    },
    back(): boolean {
      if (stack.length <= 1) {
        return false
      }
      stack.pop()
      notify()
      return true
    },
    reset(screen): void {
      stack = [screen]
      notify()
    },
    onChange(listener): void {
      listeners.push(listener)
    },
  }
}
