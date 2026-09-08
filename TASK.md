# TASK

Deliverables for **M8 — fixed layouts, three grades, nine themes**, from `plan.md`
sections 2.7, 2.9, 5.1, 8.1, 8.2 and 14. Milestones M0 to M7 are recorded in
`plan.md` section 14 and are not restated here.

Work them in order. Each one leaves the suite green and the app playable.

- [x] TASK-001: Remove the Extreme difficulty
- [x] TASK-002: Add the fixed layout table
- [x] TASK-003: Phase 1 reads a layout instead of searching for a mesh
- [x] TASK-004: Fill and mask across mixed equation lengths
- [ ] TASK-005: Re-measure Hard and reset its mask targets
- [ ] TASK-006: Render an 11 x 11 board on a phone
- [ ] TASK-007: The five named palettes and their previews
- [ ] TASK-008: Documentation and store listing

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

## TASK-005: Re-measure Hard and reset its mask targets

Depends on: TASK-004
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

Done when: the slow suite passes inside its wall-clock ceiling and the learnings file
describes the boards that were actually measured.

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

## TASK-008: Documentation and store listing

Depends on: TASK-001, TASK-003, TASK-005, TASK-007

- `README.md`: three difficulties, the new grid sizes, the nine themes.
- `store/listing.md`: remove Extreme from the difficulty list and the descriptions.
- Confirm `plan.md` sections 2.7, 2.9 and 5.6 match what was actually measured and
  built, and correct them where they do not.

Done when: no user-facing text describes four difficulties or a 9 x 9 board.
