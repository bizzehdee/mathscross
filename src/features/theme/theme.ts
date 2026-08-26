/**
 * Theme selection. Plan section 8.1.
 *
 * Custom property sets selected by a `data-theme` attribute, with
 * `prefers-color-scheme` as the default.
 */
export type ThemeChoice = 'system' | 'light' | 'dark' | 'contrast'

export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
}

export const ALL_THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark', 'contrast']

/**
 * Applies a theme to the document.
 *
 * `system` **removes** the attribute rather than setting a value, so the
 * `prefers-color-scheme` rules take over. Setting `data-theme="system"` would match
 * no rule in `tokens.css` and silently give the light palette on a device set to
 * dark — which looks like the setting being ignored.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement): void {
  if (choice === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', choice)
}

/** The theme actually in effect, resolving `system` against the OS setting. */
export function effectiveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): 'light' | 'dark' | 'contrast' {
  if (choice === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return choice
}
