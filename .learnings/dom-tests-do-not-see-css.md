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

## A fourth defect, found by a player and measured in the browser

Reported as "the board jumps around in landscape when I click between a number
square and an operator square". Measured on an 844x390 board:

| Focused cell | Board x | Board width | Keypad width |
|---|---|---|---|
| digit | 12 | 186.8 | 425.3 |
| operator | 88.8 | 224 | 200 |

So the board moved 76.8px **and resized by 20%** on every switch between the two
kinds of cell — the cell under the finger was no longer under the finger.

Three things compounded, and it took the measurement to separate them:

1. The keypad is as wide as whichever pad is showing: ten digit keys make it
   425px, two to four operator keys make it 200px.
2. `.layout` centres its row, so a narrower keypad re-centred the board.
3. The board is an ordinary flex item, so with the wider digit pad the row
   overflowed and **the board was shrunk** — discarding the size its own `min()`
   had just computed.

Fixing any one of these leaves a visible defect: without (3) the board still
resizes, without (2) it still shifts.

The same root cause had a second, unreported form. In the stacked layout the pads
differ in *height* (148px for two rows of digits, 96px for one row of operators),
which moved Clear, Undo, Redo and the clock by 52px. Confirmed by removing the new
`min-height` in the browser and re-measuring: 615.9 → 563.9.

**The general rule this adds: a component whose size depends on its contents must
not be a sibling of anything whose position matters.** Either give it a fixed box
or stop the neighbour from responding. Both fixes here are floors — a fixed keypad
width and a two-row `min-height` — chosen over letting the layout react, because a
layout that reacts to a selection is a layout that moves under the player's finger.

And the verification method: read `getBoundingClientRect()` before and after the
interaction, then toggle the candidate rule off in the browser and re-measure. That
turns "it looks like it jumps" into two numbers and a cause, and it is the only way
found so far to check a layout rule that no test can see.
