/**
 * Themes. Plan section 8.1.
 *
 * The palette test reads `tokens.css` as text rather than through a DOM, because
 * jsdom does not apply a stylesheet — the lesson in
 * `.learnings/dom-tests-do-not-see-css.md`. Text is enough for the question being
 * asked: does every palette set every token, or does one of them inherit a light
 * value into a dark board.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_THEMES, THEME_LABELS, applyTheme, effectiveTheme, isTheme } from './theme'

const TOKENS = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')

/** Every custom property a palette is responsible for. */
const PALETTE_TOKENS = [
  '--colour-surface',
  '--colour-surface-raised',
  '--colour-ink',
  '--colour-ink-muted',
  '--colour-line',
  '--colour-line-strong',
  '--colour-accent',
  '--colour-group',
  '--colour-block',
  '--colour-cell',
]

/** The declaration block whose selector list contains `selector`. */
function blockFor(selector: string): string {
  const at = TOKENS.indexOf(selector)
  if (at === -1) {
    throw new Error(`no rule for ${selector}`)
  }
  const open = TOKENS.indexOf('{', at)
  const close = TOKENS.indexOf('}', open)
  return TOKENS.slice(open, close)
}

describe('every palette is complete', () => {
  it('the light palette on :root sets every token', () => {
    // Light has no `data-theme` rule of its own: it is what `:root` holds, and every
    // other palette overrides from there. So this is the one that must be complete
    // for any of the others to inherit sensibly.
    const block = blockFor(':root {')
    for (const token of PALETTE_TOKENS) {
      expect(block, `:root is missing ${token}`).toContain(`${token}:`)
    }
  })

  const NAMED = ALL_THEMES.filter((theme) => theme !== 'system' && theme !== 'light')

  it.each(NAMED)('%s sets every token', (theme) => {
    // A palette missing one token inherits the light value, which is how a dark
    // board ends up with a light block in it. `--colour-block` and `--colour-cell`
    // are the two the sibling has no equivalent of, so they are the two most likely
    // to be forgotten when a palette is copied across.
    const block = blockFor(`:root[data-theme='${theme}']`)
    for (const token of PALETTE_TOKENS) {
      expect(block, `${theme} is missing ${token}`).toContain(`${token}:`)
    }
  })

  it.each(ALL_THEMES)('%s has a preview form declared with it', (theme) => {
    // The settings screen paints its miniature board with `[data-theme-preview]`,
    // and a preview sits inside a document already painted in another theme, so it
    // has to set the whole palette rather than inherit it. Declared on the same rule
    // as the applied form, because a second copy of the colours would drift.
    expect(TOKENS).toContain(`[data-theme-preview='${theme}']`)
  })

  it('gives the light palette a preview form of its own', () => {
    // `:root` carries the light values, and a `:root` rule cannot paint a preview
    // that is not the root. Light and system therefore need them spelled out.
    const block = blockFor(`[data-theme-preview='light']`)
    for (const token of PALETTE_TOKENS) {
      expect(block, `the light preview is missing ${token}`).toContain(`${token}:`)
    }
  })
})

describe('choices', () => {
  it('labels every theme', () => {
    for (const theme of ALL_THEMES) {
      expect(THEME_LABELS[theme], theme).toBeTruthy()
    }
  })

  it('accepts a stored theme it knows and rejects one it does not', () => {
    for (const theme of ALL_THEMES) {
      expect(isTheme(theme), theme).toBe(true)
    }
    expect(isTheme('neon')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('applies a named palette as a data-theme attribute', () => {
    const root = { removeAttribute: () => {}, setAttribute: () => {} } as unknown as HTMLElement
    const set: string[] = []
    root.setAttribute = (name: string, value: string) => set.push(`${name}=${value}`)
    applyTheme('football', root)
    expect(set).toEqual(['data-theme=football'])
  })

  it('resolves system against the device and leaves the rest alone', () => {
    expect(effectiveTheme('system', true)).toBe('dark')
    expect(effectiveTheme('system', false)).toBe('light')
    expect(effectiveTheme('ocean', true)).toBe('ocean')
  })
})
