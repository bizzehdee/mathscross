# Asserting which screen is showing is not asserting it has anything on it

Established in MathsCross, 2026-08-27, from a player report: "how to play has been
left blank too".

## The observation

Dismiss the how-to-play card once. Choose "How to play" from the menu. The screen
is blank — header, back button, version footer, and nothing between them.

This test passed throughout:

```ts
it('can reach how to play again from home', () => {
  const root = mountReady()
  button(root, 'How to play').click()

  expect(visibleScreen(root)).toBe('howtoplay')
})
```

It is a true assertion about the wrong thing. The screen container was visible. Its
only child was not.

## The cause

The card starts `hidden`, deliberately, so a returning player does not see it flash
past on the way to the menu. It was shown by exactly one line, in the first-run
branch at mount. Nothing showed it when the router arrived at that screen later, so
every visit after the first got the empty container.

The fix moves the responsibility to `showScreen`, next to the existing
`if (screen === 'stats') statsView.render(stats)` — which is the same pattern, and
was already correct for the screen that happened to have it.

## Why the test could not have caught it

Nothing to do with jsdom's limits. `element.hidden` is perfectly readable there.
The test simply asserted the navigation and stopped, and "did the navigation work"
is the question that feels like the whole of the behaviour when writing it.

The new test asks the next question:

```ts
const card = root.querySelector<HTMLElement>('.onboarding')
expect(card?.hidden).toBe(false)
expect(card?.textContent).toContain('Numbers span cells')
```

Verified by disabling the fix and watching only the new test fail.

## The rule

**A test that a screen, panel, dialog or route is showing must also assert
something that is only true when its contents are there.** Text, a heading, a
child count — anything that fails when the container is empty.

This is the same shape as the elapsed-time defect recorded in
[pausing-a-clock-is-not-recording-it.md](pausing-a-clock-is-not-recording-it.md):
the test checked that navigating away worked, not that anything was written down on
the way. Both bugs lived under a green suite, and in both cases the assertion
stopped one question short of the behaviour a player would notice.

A useful prompt when writing the assertion: **what would still pass if this screen
rendered nothing at all?**
