# A drawn layout must be checked against the fill, not just against the eye

Established 2026-09-08, at M8, building the fixed layouts of plan section 2.9. Two
hand-drawn Hard boards were unbuildable, in two different ways, and both looked
correct: symmetric, fully covered, connected, every equation long enough.

## The facts

**A 7-cell equation cannot cross at every even offset.** Only three width triples
are arithmetically possible at 7 cells — `(1, 2, 2)`, `(2, 1, 2)` and `(2, 2, 1)` —
and their operator and equals cells sit at offsets `{1, 4}`, `{2, 4}` and `{2, 5}`.
A line crossed at offsets 0, 2, 4 and 6 therefore has a non-digit at one of its
crossings whichever triple it takes. No width assignment exists, for any seed.
5-cell and 11-cell equations both survive the same lattice.

**An equation with no cell of its own can only come out true by luck.** The fill
draws two terms and derives the third. An equation whose every digit is fixed by the
equations crossing it has nothing to draw. On a lattice whose lines sit two apart, a
5-cell equation is *entirely* crossings — its digits are at offsets 0, 2 and 4, and
every even offset meets a line — so twelve of them on one board had to come out true
simultaneously by chance. Hard exhausted the 5000-attempt cap on every seed.

**Interval arithmetic is not a feasibility check on its own.** It admits
`(1, 3, 1)` at 11 cells because `0 * 123 = 0` is in range: true, banned by plan
section 2.7.1 as a question whose answer can be copied, and the only way the triple
can hold. A check that ignores the degenerate rule reports a width as usable when
every instance of it is illegal.

## Why it matters

All three failures surface at fill time, thousands of attempts later, with a symptom
that points at the fill. The fill is the most complex part of generation and the
least likely to be innocent, so the investigation starts in the wrong place.

Easy is the counter-example that locates the real variable. All nine of its digit
cells are crossings too, and it generates in a millisecond — because a board of
single digits comes out true by luck often enough that retrying is cheap. Luck stops
being cheap the moment a term has more than ten possible values.

## What to do

Assert these on the layout table itself, where a failure names the layout:

- Every equation has at least one arithmetically usable width triple, with the
  degenerate rule applied as well as the range check.
- Some assignment of triples puts a digit cell at every crossing.
- Every equation has at least one digit cell no other equation touches, at any
  difficulty whose values run past a single digit.

`src/engine/layouts.test.ts` holds all three. They cost milliseconds and they run
without generating a board.
