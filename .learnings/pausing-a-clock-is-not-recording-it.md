# Pausing a clock is not the same as recording it

Established in MathsCross, 2026-08-26, playing the first deployed build on GitHub
Pages. Not found by the test suite, which was 207 green at the time.

## The observation

Start an Easy puzzle. Let it run three seconds. Press Menu. Press Continue.

The clock reads `0:00`, and the menu's Continue button had said "0:00 played".

## The cause

Two separate gaps that hid each other.

The elapsed total was written to storage only from the function that runs after a
cell changes. Nothing wrote it on the way out of the board. So the stored value
was always the time of the player's **last entry**, never the time they left, and
everything after the last entry was discarded on resume.

The timer, meanwhile, was paused only on `visibilitychange` and Cordova's `pause`.
Leaving the board for the menu did not pause it, so the clock kept running on a
board nobody was looking at. That second gap was invisible, because resuming
rebuilt the session from the stored total and threw the running timer away — one
bug concealing the other.

## Why the tests did not catch it

`bindTimerToVisibility` had no test at all. Nothing exercised the pause paths.

And nothing could have, at the level it mattered: `mountApp` built its timer with
`createTimer()`, reading the real clock. A DOM test cannot advance real time, so it
cannot assert on elapsed time, so it asserted nothing about it. The timer module
itself already injected its clock for exactly this reason — the seam existed one
layer down and stopped there.

The fix included threading the clock through `AppOptions`. The two tests that now
guard this are only writable because of it.

## What made it low severity, and why that is the trap

Completed puzzles recorded the correct time throughout: a solve reads the live
timer, not the stored total. So every statistic looked right. The only symptoms
were a resumed board's clock and a label on a button, and both look like rounding
rather than loss.

A defect that corrupts nothing and merely under-reports is one nobody files.

## The rule

**Every pause is a checkpoint.** If a clock can stop, the thing that stops it is
responsible for writing down where it stopped. Pausing and persisting on different
triggers means the two drift by however long the player was idle.

Concretely: pause on `visibilitychange`, the Cordova `pause` event, `pagehide`, and
on leaving the screen the clock belongs to — and persist on all four. `pagehide` is
the last event a closing tab reliably delivers, and it is a **window** event, not a
document one; registering it on the document silently never fires.

And when adding the pause on leaving a screen, add the matching resume in the same
change. MathsCross's session starts by resetting the router to home before
navigating to the game, so the suspend fired on the way past and would have left
every new board's clock stopped for its whole life. That regression was caught only
because the second test asserted the resume as well as the pause.
