# TASK

Deliverables for **M8 — fixed layouts, three grades, nine themes**, from `plan.md`
sections 2.7, 2.9, 5.1, 8.1, 8.2 and 14. Milestones M0 to M7 are recorded in
`plan.md` section 14 and are not restated here.

Work them in order. Each one leaves the suite green and the app playable.

- [x] TASK-001: Remove the Extreme difficulty
- [x] TASK-002: Add the fixed layout table
- [x] TASK-003: Phase 1 reads a layout instead of searching for a mesh
- [x] TASK-004: Fill and mask across mixed equation lengths
- [x] TASK-009: Make the uniqueness check stop re-deriving what did not change
- [x] TASK-005: Re-measure Hard and reset its mask targets
- [x] TASK-006: Render an 11 x 11 board on a phone
- [x] TASK-007: The five named palettes and their previews
- [ ] TASK-008: Documentation and store listing
- [x] TASK-010: The header takes 86px of a landscape phone

---

## TASK-001: Remove the Extreme difficulty

Required by: TASK-003, TASK-008

Three grades: Easy, Medium, Hard. `plan.md` section 2.7.

- Drop `Extreme` from the `Difficulty` union, `ALL_DIFFICULTIES` and the parameter
  table in `src/engine/difficulty.ts`.
- Daily rotation becomes Mon/Tue Easy, Wed/Thu/Fri Medium, Sat/Sun Hard, per section
  5.7.
- Remove it from the difficulty menu, the completion screen, the keypad tests and
  anywhere else it is named in `src/ui/` and `src/features/`.
- **Persistence must survive a stored `extreme`.** A saved board, a daily slot or a
  stats record written by an earlier version can name a difficulty that no longer
  exists. Decide what each does — a stored board with an unknown difficulty is
  discarded, stats for an unknown difficulty are dropped — and make the read path
  return defaults rather than throw.
- Division and 100% operator masking become unused capability. Keep both, and keep
  their engine tests: section 2.7 records why.

Done when: the app builds, no source file outside `plan.md` says `extreme`, and a
test loads a stats and a board payload naming `extreme` and shows the app recovers.

## TASK-002: Add the fixed layout table

Required by: TASK-003

Landed with TASK-003 in one commit. An 11-cell line cannot be fed by a 7 x 7 grade's
value range, so the layout table and the difficulty parameters cannot land
separately without leaving Hard unable to generate.

`src/engine/layouts.ts`, holding the three grids of `plan.md` section 2.9 as data,
their equation lists, and the feasible width triples from section 2.6. Nothing
consumes it yet; this task is the table and its proof.

Assertions, in the fast suite, on the table alone and generating nothing:

- The equation list matches the runs of 5 or more non-block cells in the grid.
- Every non-block cell belongs to at least one equation.
- The equations form one connected component, with no two parallel equations in
  adjacent rows or columns.
- Every equation has at least one feasible width triple, and some assignment of
  triples puts a digit cell at every intersection.
- Counts match section 2.9: Easy 6 equations and 9 intersections, Medium 6 and 9,
  Hard 18 and 36.

Also record `.learnings/a-seven-cell-equation-cannot-cross-on-even-offsets.md`: the
Hard layout as first drawn was unbuildable, why interval arithmetic alone did not
catch it, and the rule that a 7-cell equation cannot cross at every even offset of a
2-spaced lattice. Section 2.9 has the detail; the learning is the short form.

Done when: the layout tests pass and the learning is indexed in `.learnings/index.md`.

## TASK-003: Phase 1 reads a layout instead of searching for a mesh

Depends on: TASK-001, TASK-002
Required by: TASK-004, TASK-006

`plan.md` section 5.1. Replace the mesh search with a lookup and a width assignment.

- Delete `candidatePatterns`, `candidateLayouts`, `nonAdjacentSubsets` and the layout
  scoring from `src/engine/mesh.ts`. What remains is painting a layout's kinds and
  assigning widths with the seeded PRNG.
- Move the grid sizes and value ranges to their section 2.7 values in the same
  change: Medium 7 x 7 unchanged, Hard 11 x 11 and 0 to 999. They cannot move
  separately from the layouts.
- Drop `minIntersections`, `maxIntersections`, `minEquationLength` and
  `maxEquationLength` from `DifficultyParameters` if nothing else reads them. They
  described a search that no longer exists.
- Width feasibility must apply the section 2.7.1 degenerate rule as well as interval
  arithmetic. `widthsFeasible` today admits `(1, 3, 1)` on the strength of
  `0 * 123 = 0`, which section 2.7.1 forbids.
- Medium picks widths per equation from all three feasible triples, so one layout
  yields 3^6 shapes. Easy and Hard have one triple per length.

Done when: all three difficulties generate, determinism holds — the same seed and
difficulty give the same board — and every section 13.3 property passes.

## TASK-004: Fill and mask across mixed equation lengths

Depends on: TASK-003
Required by: TASK-005

Hard's board carries 5-cell and 11-cell equations at once, and the fill was written
when every equation on a board shared one pattern.

- The fill orders equations breadth-first and derives the widest term. Confirm both
  still hold when a 5-cell equation inherits digits from an 11-cell one.
- Masking is unchanged in principle. Confirm `maskOrder`'s intersection weighting
  behaves when intersection counts per cell differ more widely than before.
- Three-digit operands are three variables each. Watch the uniqueness node budget:
  section 5.4 step 4 already refuses a mask it cannot cheaply prove safe, and that is
  the right failure.

Done when: 60 seeds per difficulty generate with zero failures in the fast suite, and
every equation on every board satisfies its difficulty's constraints.

## TASK-009: Make the uniqueness check stop re-deriving what did not change

Depends on: TASK-004
Required by: TASK-005

Appended after TASK-004 measured Hard at 3.5 s a board and a CPU profile said where
it goes. Masking is 99.3% of that time, the fill 0.7%, and inside masking about 55%
of all time is spent re-evaluating equations that did not change: `propagate` walks
all 14 equations on every pass, and one assignment touches at most two of them.

Profile over three Hard boards, 5,977 ms, by self time: `evaluateSide` 22.3%,
`propagate` 13.4%, `isAssignable` 10.2%, `propagateNumbers` 9.8%, `equationState`
8.6%, `search` 7.5%, `readNumber` 6.5%, `readTerms` 4.3%, `knownDigitCount` 4.1%.
689,138 search nodes over 130 checks, 5,301 nodes a check, 8.84 us a node.

Five changes, in profile order. None changes what the solver decides:

1. **Propagate only the equations a change touched.** Seed the work list with the
   assigned cell's equations, and add an equation back when one of its cells is
   written. Propagation is monotone, so the fixed point is the same one.
2. **Count empty cells inline.** `assignableAmong` allocates an array to answer
   "none, one, or more than one", per equation per pass.
3. **Precompute `binaryShape` per equation at compile time.** It depends only on
   cell kinds and is currently recomputed 9.9 million times a board.
4. **Reuse the snapshot buffer in `search`.** A fresh `Int8Array` per candidate per
   node is millions of allocations; a buffer per recursion depth is none.
5. **Precompute each equation's two sides.** `equationState` calls `findIndex` and
   allocates two `slice`s on every call, and it is called from four places in the
   solver's hot loop.

Do this **before** TASK-005. A faster solver settles checks that used to exhaust the
node budget, so it changes achieved density — measuring first would mean measuring
twice.

Expect the generated puzzles to change for a given seed: a mask that was refused
because a check could not be settled cheaply may now be accepted. Plan section 5.7
already accepts that a generator change alters dailies nobody has opened, and the
bundled starter board is regenerated when it does.

Done when: the suite passes unchanged, determinism still holds, and the measured
cost per Hard board is recorded here and in the learnings file.

**Done. Hard went from 3,471 ms a board to 772 ms, 4.5x, and the suite from 34
seconds to 14.** Easy and Medium are unchanged at 7 ms and 4 ms; they were never
slow. Achieved density is unchanged, and puzzles are byte-identical for the same
seed — checked by generating from both trees and diffing, so the warning about
changed dailies did not apply in the end.

A sixth change was needed and is the one that paid best: when an equation has a
single empty cell, only the side holding that cell can change, so the other is
evaluated once and compared against rather than re-evaluated per candidate.

One of the five failed and was reverted. Reusing module-level scratch arrays in
`evaluateSide` was *slower* than the allocation it replaced, 2,711 ms to 3,436 ms.
Removing the arrays entirely — three local numbers carrying the running total, the
pending operator and the multiplicative chain — is what worked. Recorded in
`.learnings/generation-measurements.md`.

What is left is flat: no single function is above 20% of the remaining time. Going
further needs fewer search nodes rather than cheaper ones, which means stronger
propagation, and that would change which puzzles a seed produces.

## TASK-005: Re-measure Hard and reset its mask targets

Depends on: TASK-004, TASK-009
Required by: TASK-008

`plan.md` sections 2.7 and 5.6. Hard's 50% and 30% were measured on a 7 x 7 with
seven equations and are not evidence about an 11 x 11 with 18.

- Run the slow suite, 100 seeds per difficulty. Record median and worst attempts,
  median and worst milliseconds, achieved mask density and blanks per board.
- Set Hard's two targets to what uniqueness allows, as M2 did. Do not carry the old
  figures forward and do not widen the tolerance to make an assertion pass.
- Rewrite the figures in `.learnings/generation-measurements.md`, marking the
  superseded ones as measured on the old boards.
- Add the blanks-per-board ladder assertion from section 13.4.
- If Hard cannot generate inside the attempt cap, take the retreat in section 5.6 in
  order — mask density, then splitting the 11-cell lines, then the layout, then the
  grid size — and bring the change back through `plan.md` section 2.9 first.

**Done.** 100 seeds a grade, zero failures: Easy 6 ms median and 56 ms worst, Medium
4 ms and 29 ms, Hard 534 ms and 1039 ms, whole slow suite 103 seconds.

Hard's digit target moved from 0.50 to **0.48**, which is what uniqueness allows: a
target of 0.50 and a target of 1.00 both achieve 0.481, so the target was doing
nothing. Its operator target stays at 0.30, and that one is a design decision rather
than a measurement — every operator target is met in full, and the cost lands on the
digits. The frontier is recorded in `difficulty.ts` and the learnings file so it can
be reopened with numbers rather than reasoning.

Easy over-delivers at 0.444 against 0.40 and Medium under-delivers at 0.333 against
0.35, both purely from rounding a cell count: on boards this small one cell is 5 to 11
points of density. Neither needs a parameter change.

The blanks-per-board ladder is now asserted over all 100 seeds in the slow suite as
well as the fast suite's six.

## TASK-006: Render an 11 x 11 board on a phone

Depends on: TASK-003

`plan.md` section 8.2. Eleven columns at 44 px is 484 px; a portrait phone is 390 px.

- Board cells shrink to fit, with a 32 px floor. Controls, keypad and header stay at
  44 px.
- The board must still not move or resize when the selection changes. That defect was
  found by measurement once already and the fix is the fixed keypad width plus
  `flex-shrink: 0` on the board.
- Check the grouping cue still reads at 32 px: a three-cell number is the thing it
  exists for and Hard is full of them.

Done when: a Hard board is playable in a 390 x 844 viewport with no horizontal
scroll, measured rather than eyeballed, and the movement assertion still passes.

**Done, measured in a real browser rather than in jsdom.** Portrait 390 x 844: a
366 px board, 32.2 px cells, 19.2 px digits, no horizontal scroll, keypad keys still
44 px, and the board moves 0 px and resizes 0 px when the entry pad switches.

Three defects that only a browser could have shown, all fixed:

- Landscape at 844 x 390 rendered the board 224 px wide and **294 px tall**, its
  cells 20 x 27 rectangles with the last two rows off the screen. A grid row's
  automatic minimum is its content, and the digit had a font-size floor, so the rows
  refused to shrink to the square the aspect-ratio asked for.
- The cell font was sized from the board's *column count* against a viewport guess.
  It is now sized from the board's own width through a container query, so it is a
  little over half a cell at any size in either orientation.
- The landscape board used the stacked layout's height budget, which subtracts a
  keypad that in landscape is beside it rather than under it. It was falling back on
  its 224 px floor and hanging 8 px off the bottom regardless.

Landscape is still the tight case at 20.5 px cells, and the header is most of what is
eating the room. Shrinking it there is a design change rather than a fix, so it is
not made here — TASK-010.

The digit pad is also now two rows of five rather than six and four.

## TASK-007: The five named palettes and their previews

`plan.md` section 8.1. Football, space, sweets, jungle and ocean, taken from
`/mnt/data/dev/simple-sudoku/src/styles/tokens.css`.

- Nine `ThemeChoice` values, nine labels, nine palettes.
- Each palette declared once under a selector list naming both the applied form
  `:root[data-theme='x']` and the preview form `[data-theme-preview='x']`.
- `--colour-group` and `--colour-block` defined in **all nine**, not just the first
  four. A palette missing either paints a light block on a dark board.
- The sibling's five accents are kept; only the light, dark and contrast accents are
  MathsCross's own.
- Settings shows a miniature board per choice, in that choice's palette: a block
  cell, a given, an entered digit and a grouped two-cell number.
- Check the three contrast rules in section 8.1 for every palette and record the
  measured ratios in comments, as the sibling does.

Done when: a test asserts every palette defines every token the board reads, and each
of the nine renders correctly with a stored preference.

**Done.** Nine themes, each declared once under a selector list naming both the
applied form and the preview form. Every accent was checked against the cell, the
group tint and the raised surface on top of it, and every one clears 4.5:1 — the
figures are in the comment above each palette.

Settings shows a five-cell board fragment per choice, built from the real `.cell`
classes and attributes so a palette that breaks the board breaks its own preview.

One palette had to be re-cut after looking at it. Football reused the sibling's page
green for the cell, which left the page and the cells a shade apart and made the
board read as one flat rectangle of green. The four greens are now ordered block,
page, panel, cell, and the rule is recorded in plan section 8.1: a cell must not be
the colour of the page.

## TASK-008: Documentation and store listing

Depends on: TASK-001, TASK-003, TASK-005, TASK-007

- `README.md`: three difficulties, the new grid sizes, the nine themes.
- `store/listing.md`: remove Extreme from the difficulty list and the descriptions.
- Confirm `plan.md` sections 2.7, 2.9 and 5.6 match what was actually measured and
  built, and correct them where they do not.

Done when: no user-facing text describes four difficulties or a 9 x 9 board.

## TASK-010: The header takes 86px of a landscape phone

At 844 x 390 the header is 86 px tall, and it is the largest single reason the board
there is 238 px rather than 300. The board sits under a full-size title in a viewport
390 px tall, and the room the title takes is room the grid does not get.

A smaller title in the side-by-side layout would buy roughly 40 px of board, which is
about 3.5 px a cell at Hard. That is a visible change to every screen in landscape, so
it is a design decision rather than a defect fix, and it wants looking at rather than
calculating.

Also here, and smaller: the version line at the foot pushes the document 22 px past a
390 px viewport, so landscape scrolls slightly at every difficulty. It predates the
11 x 11 board.

Done when: a landscape Hard board is measured again and the figure recorded, or the
change is declined and the reason recorded.

**Done.** The title is 1.25rem in the side-by-side layout, which takes the header
from 86px to 54px, and the board's landscape height budget drops from 9.5rem to
7.5rem to spend what that freed. Measured at 844 x 390: the board is 270px and its
cells 23.5px, against 19.3px before TASK-006 and 20.5px after it. At 740 x 360 it is
240px and 20.7px.

The version line still costs a 22px scroll and is kept: it is a footer rather than
gameplay, and it is the first thing a bug report needs.
