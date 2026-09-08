/**
 * Theme selection. Plan section 8.1.
 *
 * Each choice shows a miniature board painted in its own palette, so a player picks
 * by looking rather than by reading nine names. The preview is built from the real
 * cell classes and attributes, which is what keeps it honest: it is coloured by the
 * same rules the board is, so a palette that breaks the board breaks the preview.
 */
import { ALL_THEMES, THEME_LABELS, type ThemeChoice } from '../../features/theme/theme'

export interface SettingsView {
  readonly element: HTMLElement
}

export interface SettingsCallbacks {
  readonly initial: ThemeChoice
  readonly onChoose: (theme: ThemeChoice) => void
}

/**
 * The four things a MathsCross palette has to keep apart, in one row.
 *
 * A block, a given, a two-cell number carrying the grouping cue, and a digit the
 * player entered into a satisfied equation, which is where the accent shows.
 */
function createPreview(theme: ThemeChoice): HTMLElement {
  const preview = document.createElement('span')
  preview.className = 'theme-choice__preview board'
  preview.setAttribute('data-theme-preview', theme)
  // Decorative: the button already carries the theme's name.
  preview.setAttribute('aria-hidden', 'true')

  const cell = (className: string, text: string, attributes: Record<string, string> = {}) => {
    const element = document.createElement('span')
    element.className = className
    element.textContent = text
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value)
    }
    return element
  }

  preview.append(
    cell('cell cell--block', ''),
    cell('cell', '4', { 'data-editable': 'false' }),
    cell('cell', '1', { 'data-kind': 'digit', 'data-group': 'start' }),
    cell('cell', '5', { 'data-kind': 'digit', 'data-group': 'end' }),
    cell('cell', '9', { 'data-editable': 'true', 'data-equation-state': 'satisfied' }),
  )
  return preview
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
    button.className = 'button theme-choice'
    // The name is on the button rather than left to its contents, because the
    // preview inside it holds digits that would otherwise be read out as part of it.
    button.setAttribute('aria-label', THEME_LABELS[theme])

    const label = document.createElement('span')
    label.className = 'theme-choice__label'
    label.textContent = THEME_LABELS[theme]

    button.append(createPreview(theme), label)
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
