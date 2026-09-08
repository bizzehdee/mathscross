/**
 * Theme selection. Plan section 8.1.
 *
 * Custom property sets selected by a `data-theme` attribute, with
 * `prefers-color-scheme` as the default.
 */
export type ThemeChoice =
  | 'system'
  | 'light'
  | 'dark'
  | 'contrast'
  | 'football'
  | 'space'
  | 'sweets'
  | 'jungle'
  | 'ocean'

export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
  football: 'Football',
  space: 'Space',
  sweets: 'Sweets',
  jungle: 'Jungle',
  ocean: 'Ocean',
}

/**
 * The order Settings offers them in: the four neutral choices, then the five named
 * palettes. The named five exist for the players who are children, who are a stated
 * audience and are not served by three greys. Plan section 8.1.
 */
export const ALL_THEMES: readonly ThemeChoice[] = [
  'system',
  'light',
  'dark',
  'contrast',
  'football',
  'space',
  'sweets',
  'jungle',
  'ocean',
]

/**
 * Whether an arbitrary value names a theme.
 *
 * Storage is why this exists: a settings record written by another version can name
 * a theme this one does not have, and a stored string cast through would set a
 * `data-theme` matching no rule, which silently paints the light palette.
 */
export function isTheme(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (ALL_THEMES as readonly string[]).includes(value)
}

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
): Exclude<ThemeChoice, 'system'> {
  if (choice === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return choice
}
