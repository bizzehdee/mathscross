// @vitest-environment jsdom
/**
 * The entry pads. Plan section 8.6.
 *
 * These matter most at Hard, where every operator is masked, so the operator pad
 * is not a corner case but the main way a Hard puzzle is played.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { Difficulty } from '../../engine/difficulty'
import { CellKind, Operator } from '../../engine/types'
import { createKeypadView } from './keypad'

function mount(difficulty: Difficulty) {
  const values: number[] = []
  let cleared = 0
  const view = createKeypadView(difficulty, {
    onValue: (value) => values.push(value),
    onClear: () => {
      cleared += 1
    },
  })
  document.body.replaceChildren(view.element)
  return { view, values, cleared: () => cleared }
}

function pad(view: { element: HTMLElement }, which: 'digits' | 'operators'): HTMLElement {
  const element = view.element.querySelector<HTMLElement>(`.keypad__pad--${which}`)
  if (element === null) {
    throw new Error(`no ${which} pad`)
  }
  return element
}

function visibleOperators(view: { element: HTMLElement }): string[] {
  return [...pad(view, 'operators').querySelectorAll<HTMLElement>('.keypad__key')]
    .filter((key) => !key.hidden)
    .map((key) => key.getAttribute('aria-label') ?? '')
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe('which operators are offered', () => {
  it('offers only the difficulty’s own operators', () => {
    // Easy is plus and minus. Offering times or divide would invite an entry that
    // can never be right.
    const easy = mount(Difficulty.Easy)
    expect(visibleOperators(easy.view)).toEqual(['Plus', 'Minus'])

    const hard = mount(Difficulty.Hard)
    expect(visibleOperators(hard.view)).toEqual(['Plus', 'Minus', 'Times', 'Divided by'])
  })

  it('omits division at Medium', () => {
    const medium = mount(Difficulty.Medium)
    expect(visibleOperators(medium.view)).not.toContain('Divided by')
  })
})

describe('the pad follows the focused cell', () => {
  it('shows digits for a digit cell and hides operators', () => {
    const view = mount(Difficulty.Hard)
    view.view.showFor(CellKind.Digit, false)

    expect(pad(view.view, 'digits').hidden).toBe(false)
    expect(pad(view.view, 'operators').hidden).toBe(true)
  })

  it('shows operators for an operator cell and hides digits', () => {
    // Hard masks every operator, so this is the ordinary case there rather than
    // an edge one.
    const view = mount(Difficulty.Hard)
    view.view.showFor(CellKind.Operator, false)

    expect(pad(view.view, 'operators').hidden).toBe(false)
    expect(pad(view.view, 'digits').hidden).toBe(true)
  })

  it('offers only minus in a sign position', () => {
    // A sign position admits only minus: a unary plus carries no meaning, so
    // offering the rest would invite an entry that can never be right.
    // Plan section 2.3.
    const view = mount(Difficulty.Hard)
    view.view.showFor(CellKind.Operator, true)

    expect(visibleOperators(view.view)).toEqual(['Minus'])
  })

  it('hides both pads when nothing is focused', () => {
    const view = mount(Difficulty.Hard)
    view.view.showFor(undefined, false)

    expect(pad(view.view, 'digits').hidden).toBe(true)
    expect(pad(view.view, 'operators').hidden).toBe(true)
  })
})

describe('entry', () => {
  it('reports the digit pressed', () => {
    const view = mount(Difficulty.Easy)
    view.view.showFor(CellKind.Digit, false)

    pad(view.view, 'digits')
      .querySelector<HTMLElement>('[aria-label="Digit 7"]')
      ?.click()

    expect(view.values).toEqual([7])
  })

  it('reports the operator pressed as its stored value, not its glyph', () => {
    const view = mount(Difficulty.Hard)
    view.view.showFor(CellKind.Operator, false)

    pad(view.view, 'operators')
      .querySelector<HTMLElement>('[aria-label="Divided by"]')
      ?.click()

    expect(view.values).toEqual([Operator.Divide])
  })

  it('reports a clear', () => {
    const view = mount(Difficulty.Easy)
    view.view.showFor(CellKind.Digit, false)

    view.view.element.querySelector<HTMLElement>('.keypad__clear')?.click()
    expect(view.cleared()).toBe(1)
  })
})

describe('labels', () => {
  it('names every key, since a glyph alone is not readable aloud', () => {
    const view = mount(Difficulty.Hard)

    for (const key of view.view.element.querySelectorAll<HTMLElement>('.keypad__key')) {
      expect(key.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('uses a word for clear rather than an erase glyph', () => {
    // U+232B has no coverage in the default Android or Windows UI font and renders
    // as a tofu box, which reads as a broken app.
    const view = mount(Difficulty.Easy)
    expect(view.view.element.querySelector('.keypad__clear')?.textContent).toBe('Clear')
  })
})
