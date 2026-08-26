# jsdom tests cannot see CSS, so three real defects passed them

Established 2026-08-26, at M3, while building the playing screen.

## The fact

The DOM tests run under jsdom, which parses no stylesheet from this project. Every
assertion about visibility, size or layout therefore tests the *property* rather
than what a player sees. Three defects passed a green suite of 46 DOM tests and
were found within a minute of looking at the running app.

### 1. `hidden` loses to a layout class

`element.hidden = true` sets the `hidden` attribute, which is specified as
`display: none` — but at the lowest possible specificity. Both `.onboarding` and
`.keypad__pad` set `display: flex`, so the class won and the elements stayed on
screen. Dismissing the onboarding card did nothing; switching entry pads showed
both at once.

jsdom reports `element.hidden === true` regardless, so the test asserting exactly
that passed.

The fix is a reset rule, and it belongs in every project that toggles `hidden`:

```css
[hidden] {
  display: none !important;
}
```

### 2. A `min()` width can compute negative and collapse an element

```css
width: min(100%, calc(100dvh - 20rem), var(--board-cap));
```

In a 319px-tall viewport, `100dvh - 20rem` is about −1px. `min()` duly picked it
and the board collapsed to its 4px of padding, rendering as a vertical strip of
overlapping digits.

Any `min()` term derived from viewport height needs a floor:

```css
width: min(100%, max(14rem, calc(100dvh - 20rem)), var(--board-cap));
```

### 3. A glyph with no font coverage renders as tofu

The clear key used `⌫` (U+232B), which the default Android and Windows UI fonts do
not cover. It rendered as a boxed X, which reads as a broken app rather than a
button. Replaced with the word `Clear`.

No test of any kind catches this. Only a rendered screenshot does.

## What to do about it

- **jsdom proves behaviour, not appearance.** Assert structure, roles, labels,
  attributes and event wiring there. Do not assert anything whose answer depends on
  a stylesheet, because jsdom will agree with you either way.
- **Look at the running app after any layout or visibility change.** The three
  defects above cost about a minute each to find that way and would each have
  shipped otherwise.
- **A CSS-dependent behaviour needs a CSS-level guard**, not a test. The `[hidden]`
  reset is the guard for the first defect; the `max()` floor is the guard for the
  second. Both are cheaper than a test that cannot see them.

## A related trap while verifying

Vite's HMR served a stale stylesheet: the fix was on disk and the browser still had
the old rule, so the first re-check looked like the fix had failed. Confirm a
custom property's computed value before concluding a CSS change did not work —
`getComputedStyle(el).getPropertyValue('--thing')` returning empty means the file
never arrived, not that the rule is wrong. A forced reload settles it.

## Where this applies again

Any change to `hidden` toggling, to a `min()` or `clamp()` sizing rule, or to a
glyph used as an icon. Also any time a DOM test passes and something still looks
wrong: the test is very likely asserting the property, not the pixel.
