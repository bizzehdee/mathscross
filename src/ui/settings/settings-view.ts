/**
 * Theme selection. Plan section 8.1.
 */
import { ALL_THEMES, THEME_LABELS, type ThemeChoice } from '../../features/theme/theme'

export interface SettingsView {
  readonly element: HTMLElement
}

export interface SettingsCallbacks {
  readonly initial: ThemeChoice
  readonly onChoose: (theme: ThemeChoice) => void
}

export function createSettingsView(callbacks: SettingsCallbacks): SettingsView {
  const element = document.createElement('section')
  element.className = 'settings'

  const heading = document.createElement('h2')
  heading.textContent = 'Theme'

  const group = document.createElement('div')
  group.className = 'settings__themes'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Theme')

  const buttons = new Map<ThemeChoice, HTMLButtonElement>()
  for (const theme of ALL_THEMES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button'
    button.textContent = THEME_LABELS[theme]
    button.addEventListener('click', () => {
      callbacks.onChoose(theme)
      mark(theme)
    })
    buttons.set(theme, button)
    group.append(button)
  }

  function mark(active: ThemeChoice): void {
    for (const [theme, button] of buttons) {
      button.setAttribute('data-active', theme === active ? 'true' : 'false')
      button.setAttribute('aria-pressed', theme === active ? 'true' : 'false')
    }
  }

  mark(callbacks.initial)
  element.append(heading, group)
  return { element }
}
