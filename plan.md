# MathsCross — implementation plan

## 1. Product definition

MathsCross is a minimalist, single-player, offline maths crossword. The player fills
an intersecting grid with digits and arithmetic operators so that every horizontal
and vertical equation is mathematically valid.

The game ships as a web app, installable as a PWA, and as an Android app. Both
targets build from one TypeScript codebase through two Vite configurations. Android
is wrapped with Apache Cordova. All builds and releases run through GitHub Actions.

### 1.1 Purpose

A hobby and portfolio project, paced alongside the Sudoku sibling. No revenue model:
no ads, no in-app purchase, no paid tier, now or planned. No deadline.

This frame decides trade-offs throughout. Reusing the sibling's pipeline outranks
picking the best tool in isolation, because the pipeline is the part already paid
for. Shipping a small complete game outranks shipping a large incomplete one, which
is why the Kids tier is deferred in section 1.5. Where a decision could go either
way, prefer the one with less to maintain.

### 1.2 Names

One name, two casings. The product name is `MathsCross`. Technical identifiers are
the same word lowercased, because package identifiers, repository names, and URL
paths are conventionally lowercase.

| Context | Value |
|---|---|
| All user-facing text: store listing, manifest `name`, page title, in-app copy | `MathsCross` |
| Repository directory, GitHub repository, Pages path | `mathscross` |
| Android package identifier | `com.bizzeh.mathscross` |

So the app is `MathsCross`, published from the `mathscross` repository at
`/mathscross/`, as `com.bizzeh.mathscross`.

In user-facing text, write `MathsCross`: capital `M`, capital `C`, no space. Do not
write `Mathscross`, `mathsCross`, or `Maths Cross`. The package identifier cannot be
changed after the first Play upload; the display name can.

### 1.3 Sibling project

MathsCross was scaffolded from a sibling project: an offline-first Sudoku PWA with
the same shape — seeded runtime generation, a Cordova Android shell, GitHub Pages
deployment, and Play publishing. Its pipeline was working and its costs were
measured.

MathsCross follows its conventions rather than inventing new ones: the same folder
layout, the same theme tokens, the same two-config Vite setup, and the same native
shell settings.

**Do not reference the sibling by filesystem path**, here or in code or in a
learning. A path outside this repository is true on one machine only; another
developer, a CI runner, or this machine after a reorganisation would find nothing
there. Everything MathsCross depends on has been copied into this repository:
section 12 lists the copied learnings, and section 9.6 restates the store-asset
procedure rather than pointing at it.

Deviating from a sibling convention is allowed only with a stated reason. Eight
deviations are already known and are recorded in section 11.

### 1.4 Confirmed decisions

| Decision | Choice |
|---|---|
| Purpose | Hobby and portfolio. No revenue, no deadline |
| Frontend stack | TypeScript + Vite, no UI framework |
| Puzzle delivery | Generated on device at runtime, in a Web Worker |
| Release 1 modes | Free play at Easy, Medium, Hard, plus a daily |
| Web distribution | GitHub Pages, installable as a PWA |
| Native wrapper | Cordova (`cordova-android`). Confirmed against Capacitor, section 9.1 |
| CI/CD | GitHub Actions: `ci.yml`, `pages.yml`, `release.yml`, `slow.yml` |
| Persistence | `localStorage`, one JSON value per key, behind `persist.ts` |
| In-progress slots | Two: one free play, one daily |
| Cell contents | One digit (0 to 9) per cell |
| Number bounds | A number is a maximal run of adjacent digit cells |
| Negative sign | Unary minus, identified by cell position |
| Degenerate equations | Illegal. Every equation must contain an operator |
| Negative values | Off at Easy. On at Medium and Hard |
| Audience | General adult puzzle players |
| Daily puzzle | Difficulty rotates by UTC day of week. Seeded from the date alone |
| Value ranges | Derived from equation length, not from the original specification |
| Easy grid | 5 x 5, and the entry point for new players |
| Undo | In scope. 200 moves, persisted |
| Mistake counting | Out of scope. Not well defined for this mechanic |
| Pencil marks | Out of scope for release 1 |
| Package identifier | `com.bizzeh.mathscross`. Permanent once published |
| Repository and Pages path | `mathscross`, so `APP_BASE` is `/mathscross/` |
| Accent | Indigo. `#3a5fa8` light, `#8fb0f0` dark, `#ffd400` contrast |
| Animation | Effectively none. One completion transition, reduced-motion gated |
| Theming | Sudoku's token set and four-theme model, less `--colour-note` |

### 1.5 Out of scope for release 1

Deferred features are listed with their triggers in section 17. Do not build any of
the following in release 1:

- The Kids tier. Cut because one digit per cell forced it to 5 x 5 single-digit,
  leaving it near-identical to Easy. Section 17.
- Tile Placement mode. A specified variant, not the primary mechanic.
- Hints. `hint.ts` is not created until the feature is real.
- Pencil marks, and the `--colour-note` token that exists only to serve them.
- Save codes and puzzle sharing.
- Mistake counting. A value is only wrong relative to an equation that may still be
  incomplete, so "mistake" has no clean definition here.
- Accounts, cloud sync, or any backend service.
- Ads, in-app purchase, or store billing.
- Analytics or crash reporting that transmits data off device.
- iOS release builds. The `ios` job exists in `release.yml`, disabled, matching the
  sibling.
- Multiplayer or leaderboards.

### 1.6 Success criteria for release 1

1. The mechanic passed the M0.5 playtest in section 14.
2. The web app is playable with no network connection after first load.
3. The Android app requests no `INTERNET` permission.
4. The first board on a fresh install appears with no wait, per section 5.8.
5. The main thread never blocks on generation. A generating state appears within
   150 ms, reports progress, and can be cancelled.
6. Generation succeeds within the attempt cap for at least 99% of seeds at every
   difficulty, measured over 100 seeds per difficulty in the slow suite.
7. Achieved mask density is within 10 percentage points of target at every
   difficulty, so the difficulty ladder does not collapse at the top.
8. Every generated puzzle has exactly one solution.
9. A player's completed and in-progress dailies survive a generator change.
10. `localStorage` survives an Android app restart and upgrade, verified on a device.
11. A tap on a board cell or a keypad key registers with no perceptible delay,
    verified on a device rather than in a desktop browser.
12. The board is navigable and comprehensible with a screen reader, and no state is
    conveyed by colour alone.
13. The installed Android app is at or under the ceiling measured in section 8.4.
14. Unit and fast tests pass in CI on every pull request. The slow suite passes
    nightly and on every tag.

Criteria 5 to 7 replace a flat wall-clock budget. Section 5.6 explains why a
wall-clock target was the wrong shape.

## 2. Game specification

This section restates the specification in implementation terms. It is the authority
for the engine.

### 2.1 Cell taxonomy

A puzzle is a square grid of `N x N` cells. Each cell is exactly one of:

- `digit` — holds one digit, `0` to `9`. Never more than one digit.
- `operator` — holds one of `+`, `-`, `*`, `/`.
- `equals` — holds `=`.
- `block` — void and impassable. Holds no value.

Store operators as ASCII `+ - * /`. Render them as `+ − × ÷`. Never store the
rendered glyphs. Comparison and serialisation must use the ASCII forms.

### 2.2 Numbers span cells

A **number** is a maximal run of adjacent `digit` cells within one equation, bounded
by a non-`digit` cell or by the equation's end. Digits read left-to-right in a
horizontal equation and top-to-bottom in a vertical equation.

```
[1] [5] [+] [3] [=] [1] [8]        reads 15 + 3 = 18
```

Rules:

- A number must not have a leading zero unless the number is exactly `0`. The
  generator must not produce `05`, and the solver must reject it.
- A number's cell width determines its magnitude. One cell holds 0 to 9, two cells
  hold 10 to 99, three cells hold 100 to 999. The mesh fixes the width, so the mesh
  fixes the magnitude. Section 2.6 covers the consequence.

### 2.3 Unary minus

A `-` in an `operator` cell is a **sign**, not a binary operator, when the cell
directly follows an `equals` cell or another `operator` cell. Everywhere else a `-`
is a binary subtraction.

```
[9] [-] [1] [2] [=] [-] [3]        reads 9 - 12 = -3
```

`parse.ts` must classify every `operator` cell as `binary` or `sign` from its
position alone. Store the classification on the parsed equation, not on the cell.

Two rules follow:

- A `sign` position admits only `-`. A unary `+` carries no meaning, so the solver
  must restrict a sign-position domain to the single value `-`.
- A sign consumes a cell. An equation ending in a negative three-digit number needs
  four cells for that operand, not three.

Because position alone decides the classification, the player never faces an
ambiguous cell. This holds even at Hard, where operators are masked.

### 2.4 Equations, and what makes a grid legal

An **equation** is a maximal contiguous horizontal or vertical run of non-`block`
cells that contains at least one `equals` cell. Runs are bounded by `block` cells or
by the grid edge.

Two legality rules, both stated carefully because an earlier draft got both wrong
and between them made every 5 x 5 grid unbuildable:

1. **Every non-`block` cell must belong to at least one equation.** A cell belonging
   to no equation is illegal.
2. **An equation must contain at least one `operator` cell.** A bare identity such
   as `6 = 6` gives the player nothing to deduce.

Rule 1 is deliberately *not* "a run of length one is illegal". A single cell forming
a length-one run in one direction is legal whenever it belongs to an equation running
the other way. This is ordinary crossword construction, and forbidding it would be
fatal: at Easy every equation is exactly 5 cells, so in a 5 x 5 grid every equation
is a complete row or column, and any such layout leaves length-one runs in the rows
the columns pass through. Under the wrong reading, no Easy grid exists at all.

### 2.5 Evaluation rule

**Standard operator precedence applies: BODMAS.** Division and multiplication bind
before addition and subtraction. Within one precedence tier, evaluation runs left to
right for a horizontal equation and top to bottom for a vertical one.

```
5 + 3 * 2 = 11      the multiplication binds first
10 - 3 + 2 = 9      same tier, so left to right: (10 - 3) + 2
8 / 4 / 2 = 1       same tier, so left to right: (8 / 4) / 2
```

There are no brackets and no powers on a grid, so of BODMAS only the DM-then-AS part
is operative. The left-to-right rule within a tier is not a detail to skip: without
it `10 - 3 + 2` and `8 / 4 / 2` are ambiguous.

An equation is satisfied when both sides of the `=` evaluate to the same value.

**Exact division is checked per division, in precedence order.** `6 / 4 * 2` is
invalid, because `6 / 4` is evaluated first and is not exact, even though `6 * 2 / 4`
would give 3. Do not reorder a division to make it exact.

An earlier draft of this plan specified strict left-to-right evaluation with
precedence ignored, on the grounds that it keeps mental arithmetic simple on a phone.
That was the wrong trade, and the reason is not merely that players would find it
surprising.

A maths game that contradicts school arithmetic does one of two harmful things to a
child playing it. Either it marks correct arithmetic as wrong — the player applies
what school taught, gets told they are mistaken, and has no way to tell that the game
is the thing that is unusual. Or it succeeds in teaching its own rule, and the player
then has to unlearn it. Both outcomes are worse than any phone-screen convenience,
and neither has an upside. A puzzle game may invent its own rules freely; a game
whose subject is arithmetic may not invent arithmetic.

This holds for adults too — everyone was taught BODMAS — but it is the reason the
decision is not negotiable rather than merely preferable. Matching school arithmetic
also means the rule needs no teaching at all, which resolves the onboarding question
in section 8.7.

**M0.5 found that precedence almost never arises.** It can only matter in an equation
with two operators on one side of the `=`, which needs seven cells for that side plus
two for the result. Nine cells is a full Hard row, in the single pattern that fits, so
Easy and Medium cannot express such an equation at all. Precedence is therefore a
Hard-only concern in practice — but now it is the *expected* behaviour rather than a
surprise, so its rarity costs nothing.

### 2.6 Value range is derived, not declared

Under one digit per cell, an operand's magnitude is a consequence of how many cells
the mesh gives it. The value ranges in the original specification cannot be set
independently of equation length.

Cell cost of an equation `A op B = C`, where `w` is a number's cell width:

```
length = wA + 1 + wB + 1 + wC          plus 1 per unary sign
```

| Equation length | Widest achievable operands and result |
|---|---|
| 5 cells | `9 + 9 = 9`. Single digits only |
| 7 cells | `9 + 45 = 54`. One two-digit operand and a two-digit result |
| 9 cells | `9 * 111 = 999`, or `15 * 12 = 180` |

**Decided: the derived ranges are accepted.** The difficulty table in section 2.7
states the achievable range for each difficulty, not the range from the original
specification. Equations are not lengthened to reach the original numbers, because
that would mean larger grids at every difficulty, which costs generation time and
screen space for no gameplay gain.

Two consequences follow:

1. **Easy's stated range of 1 to 20 is unreachable.** Easy is 5 x 5 with 5-cell
   equations, so every operand and result is a single digit. Easy's real range is
   0 to 9.
2. **Medium's stated maximum of 100 is unreachable.** Medium is 7 x 7 with equations
   of at most 7 cells, which caps a result at 99.

Neither is a defect. Record both in `.learnings/` during M1, so a later reader who
compares the difficulty table against the original specification does not treat the
difference as a bug and "fix" it.

### 2.7 Difficulty parameters

Hold this table in one place, `src/engine/difficulty.ts`. Do not spread these values
across the generator, the solver, and the UI.

| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Grid dimensions | 5 x 5 | 7 x 7 | 9 x 9 |
| Equation length | 5 cells | 5 to 7 cells | 5 to 9 cells |
| Allowed operators | `+` `-` | `+` `-` `*` | `+` `-` `*` `/` |
| Derived value range | 0 to 9 | -99 to 99 | -999 to 999 |
| Intersection count | 2 to 4 | 5 to 8 | 10 or more |
| Division | not used | integer results only | integer results only |
| `allowNegative` | false | true | true |
| Digit masking | 40% | 60% | 75% |
| Operator masking | 0% | 30% | 100%, provisional |

Notes on this table:

- **Easy is the entry point.** With the Kids tier deferred, Easy carries the job of
  teaching the game. Its parameters are unchanged and are already gentle: single
  digits, `+` and `-` only, and no masked operators. What Easy gains instead is the
  onboarding requirement in section 8.7.
- **Hard's 100% operator masking is a hypothesis, not a specification.** It is
  untested against two independent risks. Enjoyment: with every operator unknown, a
  player solves structure and arithmetic simultaneously across a 9 x 9 with ten or
  more intersections, which may be past the point of fun. Generator behaviour:
  uniqueness may be unreachable at that density, so the restore-on-failure loop in
  section 5.4 would claw cells back until achieved masking lands far below target —
  silently turning Hard into Medium and collapsing the top of the ladder. M0.5
  tests the first risk by hand; section 13.4 asserts against the second. Expect to
  settle nearer 60 to 70%.
- `--tap-min` is 44 px at every difficulty. The enlarged target existed only for the
  Kids tier.

### 2.8 Reference board

The specification's example board cannot be used as a fixture. It fails two of the
confirmed rules: it places `15` in a single cell, which one digit per cell forbids,
and its column 4 reads `6 = 6`, which section 2.4 forbids.

Use this board instead. It is a valid Easy 5 x 5 with every digit cell shared by two
equations, which exercises maximum intersection density. `#` marks a `block`.

```
[1] [+] [2] [=] [3]
[+] [#] [+] [#] [+]
[2] [+] [1] [=] [3]
[=] [#] [=] [#] [=]
[3] [+] [3] [=] [6]
```

Six equations, all satisfied:

```
rows     1 + 2 = 3      2 + 1 = 3      3 + 3 = 6
columns  1 + 2 = 3      2 + 1 = 3      3 + 3 = 6
```

This board is a parsing and evaluation fixture, not a difficulty-conformant puzzle.
Its nine intersections exceed the Easy range on purpose. Note also that rows 0 and 2
are separated by a row containing two operator cells, not blocks — which is legal
under section 5.1's spacing rule and would not have been under an earlier draft of
it. Put the board in `src/engine/test-fixtures.ts`, matching the sibling's
convention, and assert the engine extracts the same six equations a human reads from
it. This is the first test written in M1.

## 3. Repository layout

Mirror the sibling project. The folder names below are the sibling's, not a fresh
design, so that a person moving between the two repositories finds the same things
in the same places.

```
/
  plan.md
  README.md
  AGENTS.md
  .learnings/
  store/                      # Play listing. Uploaded by hand, ships in nothing
    listing.md                # name, descriptions, Data Safety answers
    README.md                 # how to regenerate and how to capture
    icon-512.png              # copied from public/icons/, never redrawn
    feature-graphic-1024x500.png
    screenshots/
  scripts/
    generate-icons.mjs
    generate-store-assets.mjs
    png.mjs                   # zero-dependency PNG encoder, from the sibling
    pixel-font.mjs            # 5x7 bitmap font, throws on unknown characters
  public/
    icon.svg                  # single source for all generated icons
    privacy.html              # policy URL Play requires, served from Pages
  src/
    index.html                # Vite root is src/, per the sibling
    main.ts
    vite-env.d.ts
    styles/
      tokens.css              # from the sibling: accent changed, note removed
      layout.css
    engine/                   # pure. No DOM, no platform calls, no clock
      types.ts
      difficulty.ts           # the single difficulty parameter table
      rng.ts                  # seeded deterministic PRNG
      grid.ts
      parse.ts                # grid -> equations, numbers, sign classification
      evaluate.ts             # BODMAS evaluation, validation states
      mesh.ts                 # phase 1: skeletal mesh, operand cell widths
      fill.ts                 # phase 2: operator and value fill
      solver.ts               # phase 3: DFS with forward checking, uniqueness
      mask.ts                 # phase 4: cell masking
      generate.ts             # orchestrates phases 1 to 4
      generate.worker.ts      # worker entry point
      starter.ts              # the bundled first-launch puzzle, section 5.8
      generate.test.ts
      generate.slow.test.ts   # own vitest config, own workflow
      test-fixtures.ts
    game/                     # in-progress game state, main thread
      generate-client.ts      # owns the worker, draws seeds, returns promises
      state.ts                # board state, undo and redo history
      validate.ts
      persist.ts              # the only module that touches storage
      timer.ts
    features/
      daily/                  # date -> seed, difficulty rotation, streak
      settings/
      stats/
      theme/                  # applyTheme, effectiveTheme, THEME_LABELS
    ui/
      app.ts
      platform.ts             # native detection, service worker gating
      board/
      keypad/                 # numeric pad and operator pad
      controls/               # undo, redo, timer display
      onboarding/             # first-run explainer, section 8.7
      menu/
      install/
      haptics.ts
  native/
    config.xml
    package.json
    www/                      # native Vite output. Generated. Git-ignored
    README.md                 # signing secrets and release procedure
  .github/
    workflows/
      ci.yml
      pages.yml
      release.yml
      slow.yml
  vite.config.ts              # exports createConfig(target), default 'web'
  vite.cordova.config.ts      # createConfig('native')
  vitest.config.ts
  vitest.slow.config.ts
  tsconfig.json
  .gitignore
  .gitattributes
```

Rules for this layout:

- `src/engine/` must not import from any other `src/` folder. It must not touch the
  DOM, `window`, `localStorage`, or `Date`. This keeps it deterministic and testable
  in plain Node.
- The engine never chooses a seed. It receives one. Seed drawing lives in
  `game/generate-client.ts`, per the sibling.
- A feature folder must not import another feature folder's internals.
- Do not create a module that only forwards a call to the next module.
- Tests sit beside the code they test, as `*.test.ts`, per the sibling.
- **No folder or file is created for a deferred feature.** There is no `hint.ts` and
  no `savecode/` until those features are in scope. An empty folder reserved for a
  deferred feature is an invitation to fill it. Section 17 holds the list instead.
- There is no `docs/`. `plan.md` holds the design and `.learnings/` holds hard-won
  facts. A third documentation home only splits the audience.

### 3.1 Toolchain

Match the sibling's versions so the two repositories can share fixes:

- Node 20 in CI, pinned in the workflows.
- TypeScript 7, Vite 8, Vitest 4, `vite-plugin-pwa` 1.3.
- `"type": "module"`, `"private": true`.
- Scripts: `dev`, `build`, `build:native`, `preview`, `typecheck`, `test`,
  `test:watch`, `test:slow`, `icons`, `store:assets`.

Use a second Vitest config for the slow suite rather than an environment variable.
The reason is recorded in the sibling's `windows-npm-script-env-vars.md`: npm runs
scripts through `cmd.exe` on Windows, where `VAR=1 vitest` is a parse error.

### 3.2 README

Short and practical. What MathsCross is, the BODMAS evaluation rule stated
plainly, how to run the dev server, how to build both targets, how to run the fast
and the slow suites, and a pointer to `plan.md` as the design authority. Nothing
else: the plan is not duplicated into the README.

## 4. Build targets

Follow the sibling's `createConfig(target)` factory in `vite.config.ts`, with
`vite.cordova.config.ts` calling `createConfig('native')`. One function, not two
config files with duplicated settings, so a setting cannot drift between the web and
native bundles and produce a defect reproducible on only one platform.

The three differences between targets:

| Setting | Web | Native |
|---|---|---|
| `base` | `APP_BASE`, normalised | `'./'` |
| `build.outDir` | `../dist` | `../native/www` |
| PWA plugin | enabled, `registerType: 'prompt'` | disabled |

Also follow the sibling on these points:

- Stamp `__APP_VERSION__` from the release tag, then `git describe`, then
  `package.json`.
- Define `__NATIVE_SHELL__` so runtime code can branch without sniffing the user
  agent.
- Use `registerType: 'prompt'`, never `autoUpdate`. A service worker swap must not
  discard an in-progress puzzle.
- `APP_BASE` resolves to `/mathscross/` on Pages, because the repository is
  `mathscross` and a project repository serves from a subdirectory. Never hardcode
  it: `actions/configure-pages` emits the correct value, including `/` for a custom
  domain.
- Normalise `APP_BASE` to carry both a leading and a trailing slash. GitHub Pages
  for a project repository serves from a subdirectory, and the manifest scope, the
  `start_url`, and the navigation fallback must all agree with it.

## 5. Generation

Generation runs on device in four phases, in a Web Worker. It must be deterministic,
must never emit an invalid or ambiguous puzzle, and must never block the main
thread.

### 5.1 Phase 1 — skeletal mesh

1. Initialise an empty `N x N` grid.
2. Place a seed horizontal equation across the centre row.
3. Recursively branch vertical and horizontal segments off existing cells, subject
   to these constraints:
   - Each segment length must fall in the difficulty's equation-length range.
   - **Two parallel equations must not occupy adjacent rows or columns.** They must
     be separated by at least one intervening row or column. That intervening line
     is not required to be all `block` cells — it normally carries the operator and
     `equals` cells of the perpendicular equations, as it does in section 2.8. An
     earlier draft demanded block spacing and thereby outlawed the plan's own
     reference board.
   - Every non-`block` cell must belong to at least one equation, per section 2.4.
   - The graph of connected equations must form a single connected component.
   - The intersection count must fall in the difficulty's range. **Prefer the top of
     that range.** Intersection cells are the ones that survive masking, so
     intersection density is a lever on achievable mask density rather than a free
     parameter. Section 5.4 step 2 and
     `.learnings/masking-is-limited-by-weakly-constrained-cells.md`.
4. Stop when the intersection count is met and no further segment can be placed.

The mesh must also fix **operand cell widths**. For each equation, decide how many
`digit` cells each operand and the result occupy, and whether a sign cell precedes
the result. The widths must sum to the segment length per the formula in section
2.6. This step has no counterpart in Sudoku and no counterpart in a
one-integer-per-cell design. It is where the one-digit-per-cell choice adds the most
work.

Widths must agree at intersections. Where a horizontal and a vertical equation cross
at a `digit` cell, that cell sits at some position within a number in each equation.
The mesh must record both positions. A mismatch here is the most likely source of
generator bugs, so assert width consistency at the end of phase 1.

### 5.2 Phase 2 — operator and value fill

1. Assign an operator to each `binary` operator cell from the difficulty's allowed
   set, using the seeded PRNG. Assign `-` to every `sign` cell.
2. Assign values to intersection numbers first. Intersections are the most
   constrained, so fixing them first prunes the search hardest.
3. Solve the remaining dependent numbers outward by backtracking.
4. Enforce these constraints on every assignment:
   - Division `A / B` must satisfy `A mod B == 0`.
   - Every number must fit its assigned cell width exactly, with no leading zero.
   - Negative values are permitted only when the difficulty's `allowNegative` flag
     is set.

The output is a fully solved, fully valid grid.

### 5.3 Phase 3 — uniqueness verification

Run the solver over the masked puzzle and confirm exactly one solution exists.

The check must stop the moment it finds a second solution. Do not enumerate the full
solution set. Early exit is the difference between a check costing milliseconds and
one costing seconds.

If more than one solution exists, do not discard the puzzle first. Restore one masked
cell and re-check. Discard and restart the attempt only when restoring cells fails to
reach uniqueness.

### 5.4 Phase 4 — cell masking

1. Compute target mask counts from the difficulty table.
2. Mask cells one at a time, in seeded random order, up to the targets. **Weight the
   order towards intersection cells.** A cell belonging to two equations is far more
   likely to survive masking than one belonging to one, so an unweighted order spends
   the uniqueness budget on the least maskable cells first. This is measured, not
   assumed: see `.learnings/masking-is-limited-by-weakly-constrained-cells.md`.
3. After each mask, re-run the uniqueness check. If uniqueness is lost, restore that
   cell and continue with the next candidate.
4. **Treat an operator mask exactly like a digit mask.** It is not cheaper. Usually
   the arithmetic and the cell widths force the operator, but not always: `2 ? 32 =
   ?4` admits both `2 + 32 = 34` and `2 * 32 = 64`, because two operators can agree
   on the result's digit count and its final digit. An operator mask therefore needs
   the same uniqueness check, and when the check fails the fix is to restore that
   operator, not a digit.
5. Stop when the targets are met or the candidate list is exhausted.
6. Report achieved mask density alongside the puzzle, so section 13.4 can assert on
   it and a collapsing ladder fails a test instead of shipping.

Masking a `digit` cell that holds the leading digit of a multi-cell number is legal.
The no-leading-zero rule in section 2.2 then becomes a solver constraint on that
cell, pruning its domain to 1 to 9.

Masking percentages are targets, not guarantees. A puzzle reaching 70% digit masking
at Hard instead of 75% is acceptable. A puzzle with two solutions is not. Uniqueness
always wins. What is *not* acceptable is silent collapse: if achieved density falls
more than 10 percentage points below target, the difficulty is no longer the
difficulty it claims to be, and section 13.4 fails.

M0.5 supplied an early warning about that tolerance. A Medium board built by hand
reached only 42% digit masking against its 60% target — an 18-point shortfall,
constructed deliberately rather than found by search. If the generator misses
similarly, the response is to fix the masking order or the mesh's intersection
density, per step 2. **Do not widen the tolerance in section 13.4 to make the
assertion pass**, which would defeat the assertion's purpose.

### 5.5 Determinism

Determinism matters for one reason: the daily puzzle is derived from a date, so the
same date must produce the same puzzle for as long as the generator is unchanged.

- Implement the PRNG in `src/engine/rng.ts`. Use `sfc32` or `xoshiro128**`.
- Never call `Math.random()` anywhere in `src/engine/`.
- Never call `Date.now()` or `new Date()` inside `src/engine/`. Pass time in from the
  caller.
- Never iterate a `Set` or `Map` whose insertion order depends on anything other than
  the seed.
- `generate` takes `{ seed, difficulty, onAttempt, shouldCancel }`. Only `seed` and
  `difficulty` may affect the output. The two callbacks must not influence the
  result.
- Free play draws its seed with `crypto.getRandomValues`, in
  `game/generate-client.ts`. Do not use `Date.now()` as a seed source: consecutive
  games would get adjacent seeds, and a session's seeds would be guessable from its
  start time.

Keep a single `GENERATOR_VERSION` constant, as the sibling does. It has no job in
release 1. It exists for save codes in release 2, where a shared code must decode to
the same puzzle. Section 5.7 explains why there is no separate frozen version for
dailies.

### 5.6 Cost model and the attempt cap

An earlier draft set a 300 ms wall-clock budget at the 95th percentile. The sibling's
measurements show that is the wrong shape, and the number is not achievable.

What the sibling measured, in `generation-measurements.md`:

- An attempt costs a roughly constant 3 ms. Total cost is almost entirely a function
  of how many candidate seeds are rejected before one qualifies.
- Its hard difficulty needed a median of 77 attempts, 279 ms median, and 1141 ms
  worst, over 30 seeds.
- Its initial cap of 500 attempts was inside the normal operating range and would
  have rejected legitimate seeds while reporting a defect that did not exist. The cap
  was raised to 5000.
- The hardest grade was not the slowest to generate. Cost follows how narrow the
  acceptance band is, not how hard the puzzle plays.

MathsCross attempts will cost more than 3 ms, because an attempt spans mesh search,
width assignment, fill, and a uniqueness check per masking step. Multi-cell numbers
also enlarge the variable count: a three-digit result is three variables, not one.

The design that follows:

1. **Generation runs in a worker from the start.** This is not a fallback. The
   sibling's `generate.worker.ts` and `game/generate-client.ts` are the pattern:
   worker owns generation, client owns the seed and the promise, progress is reported
   every 25 attempts, and every request is cancellable.
2. **The cap is on attempts, not on time.** Start at 5000, matching the sibling's
   corrected value. Treat exhaustion as a `failed` outcome with reason `exhausted`,
   not as a crash.
3. **The UI shows a generating state after 150 ms**, with progress and a cancel
   control. A player must never face a frozen screen.
4. **Measure before tuning.** M2 runs the slow suite over 100 seeds per difficulty
   and records median and worst attempts, median and worst milliseconds, and achieved
   mask density per difficulty into `.learnings/generation-measurements.md`. Set the
   cap from that table, not from a guess.
5. If a difficulty's median exceeds 1000 ms after measurement, widen its acceptance
   band before optimising code. A narrow band is the usual cause, per the sibling's
   finding.

One optimisation is held in reserve and must not be built before measurement shows
it is needed: cache verified skeletal meshes, including operand widths, and run only
phases 2 to 4 at runtime. This removes the most expensive search while keeping
generation on device and puzzles effectively unlimited.

### 5.7 The daily puzzle

The seed derives from the UTC date alone:

```
seed = hash(dateKey)          dateKey is YYYYMMDD in UTC
```

Difficulty rotates by UTC weekday:

| Day | Difficulty |
|---|---|
| Monday | Easy |
| Tuesday | Easy |
| Wednesday | Medium |
| Thursday | Medium |
| Friday | Medium |
| Saturday | Hard |
| Sunday | Hard |

Adjacent dates must not produce adjacent seeds, or consecutive days would give
visibly similar puzzles. Use an avalanche step, as the sibling's `dailySeed` does.

**There is no `DAILY_GENERATOR_VERSION`.** An earlier draft froze a generator version
into the daily seed forever, so that a given date produced the same puzzle across
every device for all time. That mechanism is deleted, for three reasons:

1. It made generator bugs unfixable. Any change to generation logic would either
   alter every past daily or require maintaining two generators indefinitely.
2. The parity it bought is unobservable. There are no accounts and no sync, so two
   devices belonging to the same player never share a streak regardless. The only
   thing cross-device parity buys is two *different people* comparing the same date's
   puzzle, and release 1 has no sharing, no leaderboards, and no social features.
3. The sibling does not do it. Its daily seed is derived from the date key alone, and
   it carries a single `GENERATOR_VERSION` used only for save codes.

What protects the player instead:

- **The daily puzzle is persisted into its own slot on first open.** Once a player
  has seen a daily, that exact board is theirs, immune to any later generator change.
- **Completed dailies are recorded by date key, not by puzzle content.** A streak is
  a set of dates. No generator change can touch it.
- A generator change therefore alters only dailies that no player has opened yet.
  That cost is bounded, invisible, and worth paying for the ability to fix bugs.

### 5.8 First launch and pre-generation

On a fresh install there is no cached puzzle, so without care the first thing a new
player experiences is a wait of unknown length, at exactly the moment they decide
whether to keep the app.

Two mitigations, both cheap:

1. **Bundle one pre-verified Easy puzzle** in `src/engine/starter.ts`. It is the
   first board a new player sees, and it appears instantly. Generate it once at M2
   and paste it in; it is data, not code.
2. **Pre-generate the next puzzle in the background** while the player works on the
   current one. Every start after the first is then instant too. Cancel the pending
   request if the player changes difficulty.

Together these mean a player should never watch a spinner. The generating state from
section 5.6 remains, because it is still needed when pre-generation has not finished
or has been cancelled.

## 6. Solver

### 6.1 Callers

The solver serves two callers in release 1: the phase 2 fill, and the phase 3 and 4
uniqueness checks. A third caller, hints, is deferred to release 2.

### 6.2 Approach

Depth-first search with forward checking.

Model each masked cell as a variable:

- A masked `digit` cell has domain 0 to 9, narrowed to 1 to 9 when it is the leading
  cell of a multi-cell number.
- A masked `binary` operator cell has the difficulty's allowed operator set as its
  domain.
- A masked `sign` cell has the single value `-` as its domain.

Each equation is a constraint over the cells in its run. Order variables
most-constrained-first. Propagate after each assignment: when an equation has a
single unassigned cell, solve it directly rather than searching.

Digit-level variables mean an equation constrains its cells jointly rather than one
variable per operand. Propagate at the number level where possible: if two of three
numbers in an equation are fully known, compute the third and write its digits
directly instead of searching each cell.

For the uniqueness check, return as soon as a second solution is found.

### 6.3 Deduction log

Record which techniques the solver needed:

- `direct` — an equation had one unknown number, solved by arithmetic alone.
- `domain` — a cell was fixed by intersecting the domains of two crossing equations.
- `search` — backtracking was required.

Use the log to confirm a generated puzzle is solvable by deduction rather than only
by brute force. The log is not the difficulty grade. The table in section 2.7 sets
that. It is also the input a release-2 hint feature would need, which is a reason to
record it now and not a reason to build hints now.

## 7. Persistence

### 7.1 What is stored

- Define a storage interface in `src/game/persist.ts`, following the sibling's
  `game/persist.ts`.
- **Two in-progress slots**, not one: `mathscross.game.v1` for free play, and
  `mathscross.daily.v1` for the daily. Starting a free-play puzzle must never touch
  the daily slot. The sibling keeps a single slot, which is defensible for Sudoku but
  wrong here: a daily is date-bound, so silently destroying a half-finished daily
  loses it permanently and breaks a streak through no fault of the player.
- Within free play there is one slot. Starting a new puzzle prompts before discarding
  an in-progress one.
- Each slot holds the mesh, the givens, the player's entries, the elapsed time, and
  the undo history per section 8.6.
- Also persist: settings, stats per section 7.3, and the set of completed daily date
  keys.
- **Do not persist the solution.** The sibling's `solution-concealment.md` records
  that a solution cannot be hidden from a determined client-side reader, because it
  follows from the visible givens. What is achievable is keeping it out of storage,
  so a casual inspection does not hand it over. Recompute it when a check needs it.
- Do not persist personal data. Do not persist anything identifying a device or a
  person.

### 7.2 Which storage API

`localStorage` for release 1, behind the interface in `persist.ts`. The reasoning
below matters because the obvious upgrade does not fix the problem it appears to
fix.

**The premise to correct.** A common claim is that iOS WebViews clear `localStorage`
under memory pressure, and that IndexedDB avoids it. The documented mechanism is
different, and IndexedDB does not avoid it. On iOS, Intelligent Tracking Prevention
deletes **all script-writable storage** after 7 days without site interaction. That
bucket includes IndexedDB, Cache API, and service worker registrations alongside
`localStorage`. Moving to IndexedDB, with or without `localForage`, changes nothing
about eviction. See the sibling's `ios-storage-eviction.md`.

What each option actually buys:

| Option | Buys | Does not fix |
|---|---|---|
| `localStorage` | Simplest. Synchronous. Matches the sibling | Atomicity across keys. ~5 MB quota |
| IndexedDB, via `localForage` | Large quota, structured values, transactional writes | iOS 7-day eviction. Adds a dependency |
| Cordova SQLite plugin | Durability: a native file outside the WebView storage bucket, so eviction cannot reach it | Nothing, but it is native code and a supply-chain surface, and it does not exist on the web target |

**The decision.** MathsCross state is small: two boards, two undo histories capped at
200 moves, a stats object, a settings object, and a set of date keys. That fits
`localStorage` with room to spare, and the Android shell's `https://localhost` origin
from section 9.2 makes it durable there. Release 1 ships no iOS native build, so the
eviction risk applies only to web players on iOS who have not installed to the home
screen, and home-screen installs are exempt.

**The atomicity weakness is real and must be handled.** `localStorage` has no
transaction, so a multi-key write can tear if the app is killed mid-write, leaving
inconsistent state. Handle it without changing API:

- Write each domain object as one key holding one JSON value. Never spread one object
  across several keys.
- Keep the two board slots under separate keys, so a torn write loses one board
  rather than corrupting the other or the stats.
- Every read must tolerate missing or corrupt data and return a default. Treat a read
  failure as an expected failure and return a value; do not throw. A `JSON.parse`
  failure is a normal case here, not an exception.
- Version every stored shape with a `v` field, so a later format change can migrate
  or discard rather than misread.

**When to revisit.** Move off `localStorage` if any of these becomes true:

1. An iOS native build is added. Then durability needs a native file, so use the
   SQLite plugin or `cordova-plugin-file` — not IndexedDB, which evicts identically.
2. Stored state approaches 2 MB, half the practical quota. The undo histories are the
   only part that grows, which is why section 8.6 caps them.
3. Statistics grow into a per-puzzle history worth querying rather than a set of
   counters.

Because `persist.ts` is the only module that touches the storage API, any of these
changes is confined to one file. Do not scatter storage calls through features.

### 7.3 Stats

Record only completions. Nothing tracks attempts or abandonment, which avoids ever
having to define "abandoned" and keeps the stored shape small.

Per difficulty: completed count, best time, median time.

For the daily: current streak, longest streak, total dailies completed.

Use the **median**, not the mean, so one pathological session does not distort the
figure. Store the whole object as one JSON value under one key.

**The timer must pause when the app is not in front.** Pause on `visibilitychange`
and on the Cordova pause event, and resume on the corresponding resume. Without this,
a puzzle resumed across three sittings reports a nine-hour best time and every
time-based stat becomes worthless.

### 7.4 Daily and streak semantics

- The daily slot holds **today only**. On opening the app on a new UTC date, an
  unfinished previous daily is discarded.
- Tell the player it expired. Do not let a half-finished board vanish silently.
- The current streak increments only when today's daily is completed on today's UTC
  date. A missed day resets it to zero. There is no catch-up and no backfill.
- A daily that can be finished whenever is not a daily, and a queue of half-done
  boards nags rather than motivates. This is the reason for the rule above.
- Dates are UTC, matching the sibling, so that two players in different time zones
  get the same puzzle on the same date. Document the consequence: during British
  Summer Time the daily rolls over at 01:00 local, not midnight. Written down it is a
  known property; undocumented it is a bug report.

## 8. UI, input and theming

### 8.1 Theme tokens

Copy `src/styles/tokens.css` from the sibling. Keep the same custom property names,
the same scale, and the same four-theme model: `system`, `light`, `dark`, and
`contrast`, selected by a `data-theme` attribute on the root, with
`prefers-color-scheme` as the default.

Copy `src/features/theme/theme.ts` behaviour exactly, including the detail that
`system` removes the attribute rather than setting `data-theme="system"`. Setting a
`system` value matches no rule and silently yields the light palette.

Three changes from the sibling's file:

**Change the accent.** MathsCross must not look like the same app as Sudoku on a home
screen or in a task switcher.

| Token | Sudoku | MathsCross |
|---|---|---|
| `--colour-accent` light | `#2f6f4f` | `#3a5fa8` |
| `--colour-accent` dark | `#6fbf95` | `#8fb0f0` |
| `--colour-accent` contrast | `#ffd400` | `#ffd400` (unchanged) |

Keep the contrast theme's accent unchanged. It is chosen for contrast, not for brand,
and the sibling's comment records that raising contrast is not the same as inverting
a palette. Verify the new accent against `--colour-surface-raised` in all three
palettes and record the measured ratio in a comment, matching how the sibling
documents `--colour-note` at 7.51:1.

**Delete `--colour-note`.** It exists solely for pencil marks, which are deferred to
release 2. Do not ship an unused token; add it back with the feature.

**Add `--colour-group`.** A grouping colour for multi-cell numbers, per section 8.5.
Define it in all three palettes.

### 8.2 Layout

Follow `src/styles/layout.css` from the sibling:

- Pad `#app` on all four edges with `env(safe-area-inset-*)`, not just the bottom. An
  app targeting SDK 35 or above is drawn edge to edge on Android 15 whether it asks
  to be or not, and in landscape the large inset is the left or right one.
- Use aspect ratio, not width, as the single layout trigger. A landscape phone at
  844 x 390 is narrow and short, so a width rule would give it the stacked layout,
  which cannot fit a header, a square board, controls, and a keypad in 390 px of
  height.
- Size all controls from `--tap-min`, which is 44 px everywhere.
- Give `:focus-visible` a 3 px accent outline.

### 8.3 Touch response inside the WebView

A WebView delays a tap by roughly 300 ms while it waits to see whether a second tap
is coming, which would be a double-tap zoom. That delay is the single largest reason
a web-stack game feels unlike a native one. Remove it explicitly rather than hoping
a viewport setting covers it.

- Set `touch-action: manipulation` on every interactive element: board cells, keypad
  keys, and `.button`. It disables double-tap zoom on that element while leaving
  scrolling and pinch-zoom on the page intact. Prefer it over `user-scalable=no` in
  the viewport meta, which disables pinch-zoom for everyone and is an accessibility
  regression.
- Set `-webkit-tap-highlight-color: transparent` on interactive elements, and provide
  the pressed state with an explicit `:active` rule using `--colour-accent`. The
  default grey flash is a WebView artefact and reads as a rendering fault.
- Set `user-select: none` on board cells and keypad keys. A long press on a digit
  otherwise raises a text selection handle and a context menu over the board.
- Keep `--font-ui` on `system-ui` with the sibling's fallback chain. A system font is
  already loaded, so it costs no bytes, needs no `@font-face`, and shows no flash of
  unstyled text. Do not add a web font.
- Provide the pressed state on `:active`, not only on `:hover`. A touch device has no
  hover, so a hover-only affordance is invisible to every Android player.
- Reuse the sibling's `ui/haptics.ts`. A short vibration on entry and on completion
  does more for perceived responsiveness than any visual change.

Verify touch feel on a device, not in a desktop browser with touch emulation. The tap
delay does not reproduce there.

**Animation.** Effectively none, which is consistent with a minimalist design and
with the paragraph above. No transition on cell entry: it would fight fast typing and
reintroduce latency exactly where the rules above remove it. One completion
transition, 200 ms or less, and gate that single transition on
`prefers-reduced-motion: reduce`. Haptics carry the rest of the feedback.

### 8.4 Bundle size

A logic game built on plain TypeScript with no UI framework has no reason to be
large, and staying small is worth an explicit budget rather than an assumption. Set
these as CI-enforced ceilings, and treat a breach as a defect:

| Artefact | Ceiling | Rationale |
|---|---|---|
| JS, gzipped | 100 KB | No framework, no runtime dependency. The engine is arithmetic and arrays |
| CSS, gzipped | 15 KB | Two hand-written files, tokens and layout |
| Icons and static assets | 150 KB | Four PNG icons plus one SVG source |
| Installed Android app | 5 MB | Dominated by the Cordova shell, not by the bundle |

Notes on the ceilings:

- The JS and CSS figures are budgets for code this project writes, and they are
  generous for it. Measure at M3 and tighten them to the measured size plus headroom,
  rather than leaving slack that silently absorbs a bad dependency.
- The bundled starter puzzle from section 5.8 counts against the JS figure. It is one
  Easy board, so the cost is tens of bytes, not kilobytes.
- The installed-app figure is dominated by the native shell and the WebView glue, not
  by the web bundle, so shrinking JS by 20 KB will not move it. Measure the AAB at M6
  and set the real ceiling from that, then hold it.
- Runtime generation is what keeps the app small. Bundled puzzle packs would have
  added megabytes; this design ships an algorithm and one starter board instead.
- Add a size check to `ci.yml` after M3: fail the build if a gzipped output exceeds
  its ceiling. A budget with no gate is a comment.

The one real threat to these numbers is a dependency added without weighing it.
`localForage` was considered and rejected in section 7.2, and the size cost was part
of that. Any future dependency must state its gzipped cost in the pull request.

### 8.5 The board

- Render the grid as DOM elements, one element per cell. A 9 x 9 grid is 81 elements,
  well within DOM performance limits. Do not use canvas. Canvas costs accessibility
  and text input for no measurable gain at this size.
- Every cell renders exactly one character, because a cell holds one digit, one
  operator, or one `=`. Font sizing is therefore uniform and needs no per-puzzle
  measurement. This is the main benefit of one digit per cell.
- Draw multi-cell numbers as a visually grouped run, using `--colour-group` as a
  shared background or an underline spanning the cells. Without a grouping cue the
  player cannot tell `1 5` from two separate operands. Grouping is derived from the
  mesh, so the cue is always correct.
- Mark each equation as satisfied, unsatisfied, or incomplete as the player types.
  **This must not be conveyed by colour alone**, per section 8.8.

### 8.6 Input, undo and the timer

- Provide two entry pads, because masked cells are of two kinds:
  - A numeric pad, `0` to `9`, for masked `digit` cells.
  - An operator pad for masked `operator` cells, showing only the difficulty's
    allowed operators. A sign-position cell offers `-` alone.
  Switch pads from the focused cell's kind. Do not offer operators for a digit cell.
- Do not rely on the native Android soft keyboard. It resizes the viewport and
  obscures the grid.
- Support keyboard entry on web: arrow keys move focus, digits and `+ - * /` enter
  values, backspace clears.
- Support the Android hardware back button. Back must leave the puzzle and return to
  the previous screen, and must exit the app only from the home screen.

**Undo and redo are release-1 features.** They matter more here than in Sudoku: a
Hard board has 75% of digits and every operator blank, so a player can enter dozens
of values before discovering a contradiction, and sessions routinely span sittings.

- One undoable action is one cell entry or clear. Never batch.
- Cap the history at 200 moves. That is comfortably more than any 9 x 9 needs and it
  bounds the stored payload against the threshold in section 7.2.
- **Persist the history with the puzzle**, so undo survives a resume. The moment a
  player most needs undo is immediately after returning to a half-finished board.
- A new move after an undo truncates the redo branch, as the sibling's `state.ts`
  does.

**The timer** runs while the puzzle is in front, is displayed, and feeds stats. There
is no penalty and no time limit. Pausing rules are in section 7.3.

### 8.7 Onboarding

Arithmetic needs no explaining, now that section 2.5 uses BODMAS: the game agrees
with what every player was taught. One thing does need explaining, and it is the
thing genuinely unique to this game.

**Multi-cell numbers.** A player who reads `1 5` as two operands rather than fifteen
will enter correct-looking answers, watch them be rejected, and reasonably conclude
the game is broken. It applies from the first Medium board, and the grouping cue in
section 8.5 helps but does not by itself say what the grouping means.

- Show a first-run explainer once: one dismissable card, whose subject is that
  adjacent digit cells form one number, with a worked example.
- Keep a permanent link to the same card in the menu, so it can be re-read.
- Record dismissal in settings, not in the board slot.

Do not explain operator precedence. Explaining that the game follows the normal rules
implies that it might not have, and invites a player to look for a catch.

Build it at M3, not at M7.

### 8.8 Accessibility

Pulled forward into M3. Retrofitting a grid widget at M7 costs several times what
building it correctly costs while the board is being written.

- Use `role="grid"` with rows of `gridcell`s and exactly one tab stop, following the
  sibling's `board.ts`.
- A bare digit announcement is meaningless here, because numbers span cells. Each
  cell's `aria-label` must name the digit, its position within its number, and the
  equations the cell belongs to.
- Add a live status region announcing equation state changes, so a screen reader user
  learns that an equation became satisfied without polling the grid.
- **No state may be conveyed by colour alone.** Equation state carries a second
  channel: a glyph, or an underline weight, alongside the hue. Red and green is
  exactly the encoding that fails most often, and this is a three-state distinction.
- Verify the contrast theme covers the accent change from section 8.1.

## 9. Cordova and Android

### 9.1 Cordova or Capacitor

**Decided: Cordova.** Confirmed after the comparison below, not by default. Do not
reopen this without one of the four triggers at the end of this section. The
comparison is recorded because a decision to keep the older tool is worth less than
nothing if the reasoning behind it is lost.

The friction with Cordova is real: keeping the native wrapper aligned with current
Play Store target API levels, Gradle toolchains, and splash screen APIs. Capacitor
uses the same web stack and would be the default choice for a new project with no
existing native pipeline.

**Why Capacitor is the better tool.** Five reasons, in descending order of weight for
a project of this shape:

1. **The native project is source, not build output.** Cordova regenerates
   `platforms/android` from `config.xml`, so that directory is disposable and must not
   be edited. Every native change has to be expressed indirectly: a `<preference>`,
   an `<edit-config>`, a plugin, or a build hook. Capacitor commits `android/` as
   ordinary source, opened and edited directly in Android Studio. When a Play
   requirement needs a manifest attribute or a Gradle setting, the fix is to edit the
   file rather than to find the incantation that produces the file. This is the single
   biggest difference, and it is the direct cause of the target-API-level friction.
2. **No XML patching layer between plugins and native files.** Cordova plugins mutate
   shared native files through declarative `<config-file>` transforms. Two plugins
   editing the same file is a known failure mode, and the resulting conflict surfaces
   as a Gradle error with no obvious origin. Capacitor plugins are ordinary Gradle and
   SwiftPM dependencies, so dependency conflicts resolve the way dependency conflicts
   normally do.
3. **A maintained first-party plugin set.** The plugins this project would want —
   splash screen, status bar, haptics, app lifecycle, preferences, filesystem — are
   maintained together against current platform SDKs. Much of the Cordova plugin
   ecosystem is legacy, and a plugin that stopped being updated becomes a blocker at
   the next API level bump rather than a nuisance.
4. **`@capacitor/preferences` solves the storage problem in section 7.2 outright.**
   It wraps Android `SharedPreferences` and iOS `UserDefaults`, which sit outside the
   WebView storage bucket. That is native-file durability without adding a SQLite
   plugin.
5. **A secure origin is the default, not a setting.** Capacitor serves from
   `https://localhost` on Android and `capacitor://localhost` on iOS out of the box.
   Cordova reaches the same place, but only through the three preferences in section
   9.2, and its `file://` mode remains available as a silent footgun — which is why
   the sibling had to write `native-shell-origin.md` at all.

**Where Cordova wins here, which is why the answer is still Cordova.** These are real
and specific to this project:

- **The disposable-platform model is tidier for a CI-only build.** This project has
  no native code and no native customisation beyond a handful of preferences. Cordova
  keeps `platforms/` gitignored and regenerates it in CI, so the repository holds no
  native tree at all. Capacitor would add a committed `android/` directory that must
  be maintained and migrated across Capacitor versions. For a project that never
  opens Android Studio, Cordova's model is less to own, not more.
- **The pipeline is already solved next door.** Every hard-won line in the sibling's
  `release.yml` — the `sdkmanager` platform install, JDK 21, the `versionCode` scheme,
  PKCS12 signing through `build.json`, the pinned Play publishing action — would be
  rewritten. That is real work with no user-visible benefit.
- **Advantages 1, 2, and 3 above are dormant here.** They pay off when you edit
  native files, combine plugins, or depend on a plugin ecosystem. This project does
  none of those. Advantage 4 is currently unnecessary because release 1 is
  Android-only, where `localStorage` under an `https://localhost` origin is already
  durable. Advantage 5 is handled by writing the preferences down explicitly.

So the honest summary is: Capacitor is the better tool in general, and its specific
advantages barely bite on an Android-only, plugin-free, CI-built app whose pipeline
already exists. That is what makes staying defensible rather than merely convenient.

**The trigger to switch.** Move to Capacitor when any becomes true:

1. **iOS is added.** Cordova's friction is worst on iOS, and the sibling's `ios` job
   is disabled and unproven. There is no sunk investment to protect there, so a
   second platform is the natural point to change wrapper.
2. **A Play Store requirement cannot be met on the pinned `cordova-android`.** A
   target API level that the pinned version does not support is a hard block, and
   fighting it is worse than migrating.
3. **A native file needs editing.** The moment a fix requires a manifest attribute or
   a Gradle setting that no `<preference>` or plugin exposes, advantage 1 has stopped
   being dormant and Cordova's model is now the obstacle.
4. **A third plugin is needed.** Two plugins do not collide. A plugin ecosystem does,
   and advantage 2 starts paying at roughly that point.

No trigger applies to release 1. Record this decision in `.learnings/` during M6,
with the trigger conditions, so it is not relitigated from scratch.

Do not partially migrate. The web bundle is already wrapper-agnostic: the only
wrapper-aware code is `ui/platform.ts` and the `__NATIVE_SHELL__` define from section
4. Keep it that way, and a future switch touches `native/`, `release.yml`, and one
Vite setting.

Verify the current state of both projects before acting on this section at M6. The
comparison above reflects the general shape of the two tools, not a check of their
latest releases, and release cadence is one of the things being weighed.

### 9.2 The native shell must have an origin

Do not serve the bundle from `file://`. The sibling's `native-shell-origin.md`
records why: under `file://` there is no origin, so the WebView does not guarantee
`localStorage` across app restarts or upgrades, and the page is not a secure context,
which removes `navigator.clipboard` and `navigator.serviceWorker` entirely. The
storage failure is silent, which is what makes it dangerous.

Set these preferences explicitly in `native/config.xml`, so a future edit has to be
deliberate:

```xml
<preference name="AndroidInsecureFileModeEnabled" value="false" />
<preference name="scheme" value="https" />
<preference name="hostname" value="localhost" />
```

Keep Vite's `base` at `'./'` for the native target regardless. Relative paths are a
backstop against a future change to the scheme preferences, and the failure they
prevent is loud and immediate rather than silent.

MathsCross keeps stats, settings, completed daily date keys, and two in-progress
boards in `localStorage`, with no server to recover any of it from. Losing the origin
loses the player's history.

### 9.3 Plugins

Keep the plugin list minimal. Every plugin is native code and a supply-chain surface.
Do not add one without stating the current problem it solves. Match the sibling's set
unless a stated need differs. Note that a third plugin is a trigger to reconsider the
wrapper, per section 9.1.

### 9.4 Android configuration

- Remove the `INTERNET` permission from the generated manifest. The game is offline
  by design, and the absence of the permission proves it.
- Set a Content-Security-Policy meta tag in `src/index.html` forbidding remote
  script, style, and connection sources.
- Target the API level and build tools that the pinned `cordova-android` version
  requires, and install them explicitly in CI with the preinstalled `sdkmanager`.
  Gradle will not install a missing platform itself.
- Use JDK 21 in CI.
- The package identifier is `com.bizzeh.mathscross`, in the same namespace as the
  sibling's `com.bizzeh.sudoku`. It is permanent: Play will not allow a change, and a
  different identifier is a different app listing with no shared installs or reviews.
  Set it in `native/config.xml` at M6 and never edit it again.
- The store display name is `MathsCross`, per section 1.2.
- No families declaration and no parental gate. The audience is general adult puzzle
  players, and release 1 has no external links, no ads, and no purchases. Both
  questions return if the Kids tier arrives in release 2.

### 9.5 Icon

The accent alone will not distinguish MathsCross from Sudoku at 48 px, so the mark
must differ too.

A small cell fragment, two by two or three by three, with a visible `+` and `=` in
indigo on a light ground. It reads as "grid plus arithmetic" at icon size, it is
obviously not Sudoku's mark, and it is simple enough to author as hand-written SVG in
minutes with no design tooling.

Author one `public/icon.svg` and generate every raster size from it with
`scripts/generate-icons.mjs`, reusing the sibling's script.

### 9.6 Google Play store assets

Everything Play needs that is not the binary. All of it is uploaded to Play Console
by hand, none of it ships inside the app, and it all lives in `store/`. The sibling
has solved this completely, including one non-obvious trap, so copy the approach
rather than rediscovering it. Everything needed is restated below; there is nothing
to go and read elsewhere.

Treat the sizes and requirements below as the sibling's verified values, not as
current policy. Play changes its requirements, so re-check each against Play Console
before the M7 submission.

#### What is drawn, and what is captured

The split matters and is not arbitrary.

**Drawn** — generated by `scripts/generate-store-assets.mjs`, committed to `store/`:

| Asset | Size | Notes |
|---|---|---|
| Store icon | 512 x 512 PNG | Copy from `public/icons/icon-512.png`, do not redraw. A redrawn store icon drifts away from the installed one |
| Feature graphic | exactly 1024 x 500 PNG | Play rejects any other size. No transparency |

Reuse the sibling's zero-dependency PNG encoder in `scripts/png.mjs` and its 5x7
bitmap font in `scripts/pixel-font.mjs`, so no rasteriser or design tool is needed to
reproduce either asset. The font covers only the characters its graphic uses and
throws on anything else, which means a change to the wording fails loudly instead of
silently dropping a letter. Keep that behaviour.

The feature graphic should read in the same visual language as the icon from section
9.5: indigo ground, light grid, a few filled cells suggesting entered digits, and an
operator glyph. It must be legible as a thumbnail, so no more than a few words.

**Captured** — screenshots, taken from the running app and never drawn. A store
screenshot represents the product, and an illustration of a grid that is not the
actual UI misleads whoever is deciding whether to install. This is a policy risk as
well as a dishonesty one.

| Set | Size | Notes |
|---|---|---|
| Phone | 1080 x 1920 | At least 4 needed for promotion eligibility |
| 7-inch tablet | 1920 x 1080 | Landscape shows the side-by-side layout |
| 10-inch tablet | 2560 x 1440 | Both sides must be 1080 px or more |

Play requires exactly 16:9 or 9:16, so use the listed dimensions rather than a real
device's odd aspect ratio.

#### The trap: set the CSS viewport, not the pixel size

This is the single thing to get right, and it cost the sibling enough to write down.

The board is sized with a `min()` that caps it — the sibling uses
`min(100%, calc(100dvh - 16rem), 640px)`. So a CSS viewport of 1080 px wide does
**not** produce a bigger board. It produces the same capped board sitting in the top
third of an otherwise empty frame, which looks broken.

What is wanted is a phone-sized CSS viewport at a device pixel ratio of 2, which is
what a real phone actually is:

| CSS viewport | DPR | Output |
|---|---|---|
| 540 x 960 | 2 | 1080 x 1920, laid out as a phone |
| 1080 x 1920 | 1 | 1080 x 1920, but laid out as a tablet |

For the landscape sets, a CSS viewport of 768 x 432 at DPR 2.5 gives 1920 x 1080 and
triggers the aspect-ratio layout switch from section 8.2. Expect margins either side
of the board: at 16:9 the board is capped by height, and that is genuinely how the
app looks on a 16:9 tablet.

Confirm MathsCross's own board-sizing rule before applying these numbers — the cap
may differ from 640 px, and the arithmetic follows the cap.

Verify every captured file afterwards, because a capture at the wrong DPR silently
doubles or halves the output:

```bash
node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(process.argv[1],b.readUInt32BE(16)+'x'+b.readUInt32BE(20))" store/screenshots/phone-1-board.png
```

The sibling notes that emulated desktop-browser captures did not match the app on a
real handset. Treat the table as pixel arithmetic only and judge composition on a
device or emulator.

#### What to show

Four phone screenshots, in this order. The choices are MathsCross-specific and differ
from the sibling's, because pencil marks are deferred and the evaluation rule needs
explaining:

1. A part-solved Medium board, showing the grouping cue on a multi-cell number.
2. The first-run explainer from section 8.7. Multi-cell numbers are the game's one
   surprising rule, and a player who learns it from the listing arrives already
   understanding the mechanic.
3. The difficulty menu.
4. Statistics, showing a daily streak.

Use the landscape sets on the side-by-side layout, since that is what a tablet user
is choosing between.

Set the theme deliberately rather than accepting whatever the machine is in. A mix of
light and dark shots looks accidental; one theme throughout, with at most one shot
showing the alternative, reads as a choice.

Name files so the upload order is obvious:

```
store/screenshots/phone-1-board.png
store/screenshots/phone-2-rules.png
store/screenshots/phone-3-difficulty.png
store/screenshots/phone-4-stats.png
store/screenshots/tablet7-1-board.png
store/screenshots/tablet10-1-board.png
```

#### Listing text and declarations

Keep all of it in `store/listing.md`, following the sibling's file. It holds the app
name, the short description, the full description, and the console answers, so that
what was submitted is recorded rather than remembered.

| Field | Limit | MathsCross value |
|---|---|---|
| App name | 30 characters | `MathsCross` |
| Short description | 80 characters | Written at M7. Lead with offline and no ads |
| Full description | 4000 characters | Written at M7 |

Keep the text honest. Every claim must be one the app actually meets. Overstating a
puzzle game is both a policy risk and the fastest route to one-star reviews.

MathsCross has an unusually easy set of declarations, and the listing should say so
plainly because it is a genuine differentiator:

- **Data Safety: no data collected and no data shared.** This is trivially true and
  provable — the app requests no `INTERNET` permission per section 9.4, so it cannot
  transmit anything. Answer the questionnaire accordingly.
- **Content rating:** general audience. The questionnaire has no interactive
  elements, user-generated content, or ads to declare. Section 9.4 already removed
  the families declaration along with the Kids tier.
- **Privacy policy:** Play requires a reachable URL even for an app that collects
  nothing. The sibling ships a `privacy.html` inside its native bundle; the
  MathsCross equivalent should be published on the GitHub Pages site so the URL is
  stable and independent of a release. State plainly that no data is collected,
  stored remotely, or shared.
- **Ads:** declare none.

#### Where this sits in the plan

Store assets are M7 work, but two dependencies land earlier: the icon at M5 (section
9.5) and the screenshots, which cannot be captured until the UI is finished at M6.
Generating the drawn assets is minutes; the screenshots are the part that takes an
afternoon.

## 10. GitHub Actions pipelines

Four workflows. Pin the Node version and read it in every workflow.

### 10.1 `ci.yml` — pull requests and pushes to `main`

1. Checkout.
2. Set up Node 20 with the npm cache.
3. `npm ci`.
4. `npm run typecheck`.
5. `npm test` — the fast suite only.
6. `npm run build`.
7. `npm run build:native`. The native bundle builds from the same source through a
   second config, so a change can break it while the web build still passes. It costs
   seconds and is the only step that would catch that.
8. After M3, the bundle size gate from section 8.4.

There is no lint step, because there is no linter. The sibling has none either, and
`strict` plus `noUnusedLocals` and `noUnusedParameters` covers most of what one would
catch here. Adding ESLint would be a dependency this plan has not justified.

`permissions: contents: read`. The workflow must fail if any step fails.

The slow suite is deliberately **not** here. See section 10.4.

### 10.2 `pages.yml` — on a `v*` tag

Pages deploys on tags, not on pushes to `main`. Pushes to `main` build and test in
`ci.yml` only. This is the sibling's arrangement and MathsCross follows it.

1. Checkout with `fetch-depth: 0`, so `git describe` can stamp the version.
2. Set up Node 20. `npm ci`. Typecheck. Fast tests.
3. `actions/configure-pages`, and pass its `base_path` output as `APP_BASE` to the
   build. A project repository serves from `/<repo>/`, so every asset path, the
   manifest scope, and the service worker scope must carry it. A custom domain
   resolves to `/`.
4. Upload `dist` and deploy.

Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group
`pages` with `cancel-in-progress: false`, so a tag pushed during a deploy still
publishes.

Before the first tag, add a tag rule to the `github-pages` environment. The sibling's
`github-pages-tag-deploys.md` records that a tag-triggered deploy is rejected until
that rule exists.

### 10.3 `release.yml` — on a `v*` tag

A separate workflow from `pages.yml` on purpose. A broken Android toolchain must not
stop the web release.

1. Checkout with `fetch-depth: 0`. Set up Node 20 and JDK 21.
2. `npm ci`, then `npm run build:native` to write `native/www`.
3. Install the required Android platform and build tools with the preinstalled
   `sdkmanager`.
4. `npm ci` in `native/`.
5. Stamp the version from the tag into `config.xml`, taking only the leading numeric
   part so `v1.2.3-rc1` becomes `1.2.3`.
6. Compute `versionCode` as `major * 1000000 + minor * 1000 + patch`. Do not rely on
   `cordova-android`'s default of `major * 10000 + minor * 100 + patch`: it collides,
   so `1.0.100` and `1.1.0` both produce `10100` and the second upload is rejected as
   not an increase. Fail the build if minor or patch reaches 1000.
7. Restore the keystore from `ANDROID_KEYSTORE_BASE64`, stripping whitespace before
   decoding, and write `build.json` with `jq` rather than passing passwords on a
   command line where they would appear in the process list and the log. Build
   unsigned if the secret is absent, and raise a warning rather than failing.
8. Build the AAB and the APK. Collect binaries by pattern, not by exact name: an
   unsigned build is `app-release-unsigned.apk` and a signed one is
   `app-release.apk`.
9. Upload as a workflow artifact and attach to the GitHub Release.
10. Publish to Play only when a tag, a signed build, and `PLAY_SERVICE_ACCOUNT_JSON`
    are all present. Pin the publishing action to a commit SHA, not a tag: a tag can
    be moved, and that step holds a credential that can publish to the Play account.
11. Include the disabled `ios` job, gated on a repository variable, matching the
    sibling.

Rules:

- Never commit a keystore, a password, or a signing config containing a secret. The
  `.gitignore` block covering `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.base64`,
  and `build.json` is a backstop, not permission.
- Never echo a secret to the log.
- Derive the app version from the git tag. Do not maintain a hand-edited version in a
  second place.
- Read the sibling's `play-app-signing.md` before touching the signing secrets.
  "Releases are signed by Google Play" does not remove the need for an upload key,
  and the APK CI builds is not the one users get.
- The first Play upload must be manual. Google requires it, and a personal developer
  account may need a 14-day closed test before production access is granted. Set the
  `PLAY_TRACK` variable to `internal` in the meantime.

### 10.4 `slow.yml` — nightly, on tags, and on demand

The slow suite runs 100 seeds per difficulty across three difficulties. Per the
sibling's cost model in section 5.6, that is potentially minutes of compute, and it
grows with any generator regression. Running it on every pull request would tax every
push for a signal that changes rarely.

Triggers: `schedule` nightly, `push` on `v*` tags, and `workflow_dispatch`.

1. Checkout, Node 20, `npm ci`.
2. `npm run test:slow`.
3. Fail if the job exceeds a wall-clock ceiling. Set the ceiling at M2 from the
   measured figure plus headroom. Without it, a generator regression turns into a
   quietly lengthening job instead of a failure.

The suite must also assert the properties in section 13.4, including achieved mask
density, so a collapsing difficulty ladder fails here.

## 11. Deviations from the sibling

Eight, each with a reason. Any further deviation must be added here with its reason.

1. **`--colour-accent` differs.** Two apps from the same author with the same accent
   are hard to tell apart in a task switcher. Section 8.1.
2. **`--colour-note` is deleted.** It serves pencil marks, which are deferred.
   Shipping an unused token invites someone to find a use for it. Section 8.1.
3. **A new `--colour-group` token, and a grouping cue on the board.** Sudoku has no
   multi-cell values, so it has nothing to group. Sections 8.1 and 8.5.
4. **Explicit touch-response rules.** `touch-action: manipulation`, a transparent tap
   highlight, and `user-select: none` on cells and keys. Section 8.3. Check whether
   the sibling needs the same, and back-port it if so.
5. **A CI bundle size gate.** The sibling has no size ceiling. Added here because a
   dependency-free bundle is easy to keep small and easy to lose by accident.
   Section 8.4. Consider back-porting.
6. **One `.gitignore` at the root, not two.** The sibling splits Cordova's ignores
   into `native/.gitignore`. Here they live in the root file, because `native/` does
   not exist until M6 and one list is easier to keep correct than two.
7. **Two in-progress slots, not one.** The sibling discards its single in-progress
   game when a new one starts. A date-bound daily cannot be treated that way. Section
   7.1.
8. **The slow suite runs nightly and on tags, not on every pull request.** The
   sibling runs its slow suite in `ci.yml`. A MathsCross attempt costs more than a
   Sudoku attempt, so the same arrangement would tax every push. Section 10.4.

## 12. Learnings

`.learnings/` holds non-obvious facts, with `index.md` as the entry point. Read the
entries relevant to an area before working in it, and add one when something is
discovered that the code does not already record.

Ten entries were copied from the sibling project at M0 rather than referenced by
path, so this repository is self-contained. Each names the originating project for
provenance and no location. Where a fact was measured rather than reasoned, the copy
says explicitly that the numbers belong to the other project and do not transfer.
Where a copied claim has not yet been verified against MathsCross, the copy says so.

| Entry | Read before |
|---|---|
| `sibling-project-inheritance.md` | adopting or rejecting a sibling convention |
| `masking-is-limited-by-weakly-constrained-cells.md` | changing masking order, the intersection ranges, or the mask density assertion |
| `generation-cost-follows-rejection-rate.md` | changing the attempt cap, or diagnosing a slow difficulty |
| `solution-concealment.md` | persisting anything derived from a solution |
| `native-shell-origin.md` | touching `native/config.xml` or the native base path |
| `ios-storage-eviction.md` | touching persistence or stats |
| `github-pages-tag-deploys.md` | pushing the first `v*` tag |
| `play-app-signing.md` | touching signing secrets or testing a release build |
| `windows-git-bash-mangles-app-base.md` | verifying the Pages base path locally |
| `windows-npm-script-env-vars.md` | adding a script that needs per-run configuration |
| `windows-vite-child-process-locks.md` | starting or stopping a dev server, or a build failing with `EPERM` |
| `vite-root-src-module-paths.md` | driving the app from the browser console |
| `service-worker-unverifiable-in-pane.md` | claiming offline behaviour is verified |

Two rules for writing one:

- **Never reference a path outside this repository.** Copy the content or restate
  the fact. A learning that cannot be read is not a learning.
- **Label an unverified claim as unverified**, and label a measurement with whose
  measurement it is. Restating another project's numbers as local fact is worse than
  having no entry.

## 13. Testing

Tests must pass before any task is reported as done.

### 13.1 Parsing and evaluation tests

- Parse the reference board in section 2.8 and assert the six expected equations are
  extracted.
- Assert `[1][5][+][3][=][1][8]` parses as `15 + 3 = 18`, not as four separate
  operands. This pins the number-bounds rule.
- Assert `[9][-][1][2][=][-][3]` parses as `9 - 12 = -3`, with the first `-` binary
  and the second a sign. This pins the unary minus rule.
- Assert `5 + 3 * 2 = 11` is satisfied under BODMAS, and that the left-to-right
  reading `5 + 3 * 2 = 16` is not.
- Assert `10 - 3 + 2 = 9` and `8 / 4 / 2 = 1`, which pin left-to-right association
  *within* a precedence tier. Without these two, an implementation that folds right
  to left inside a tier passes every other test here.
- Assert `6 / 4 * 2` is unsatisfiable, because exactness is checked per division in
  precedence order, and `6 / 4` is not exact. A reordering implementation would make
  it 3 and pass.
- Assert a leading zero such as `[0][5]` is rejected.
- Assert a run with no `equals` cell is reported illegal.
- Assert an equation with no `operator` cell is reported illegal.
- Assert a cell belonging to no equation is reported illegal.
- **Assert a length-one run that belongs to a perpendicular equation is legal.** This
  is the rule an earlier draft got wrong, and getting it wrong again makes every
  5 x 5 grid unbuildable. Section 2.4.

### 13.2 Solver tests

- Puzzles with a known single solution.
- Puzzles with a known second solution, asserting the check finds it and stops.
- Puzzles with no solution, asserting the solver reports failure and does not hang.
- Puzzles with masked operators, asserting the solver deduces operators as well as
  digits.
- Puzzles with a masked leading digit, asserting the solver never proposes a leading
  zero.

### 13.3 Generator tests, fast suite

For a small fixed seed set per difficulty, assert:

- Every equation satisfies the constraints in section 2.7 for its difficulty.
- Every division divides exactly.
- Every number fits its mesh-assigned cell width, with no leading zero.
- Operand widths agree at every intersection.
- The mesh forms a single connected component, with no two parallel equations in
  adjacent rows or columns, and every non-`block` cell in at least one equation.
- Every equation contains at least one operator.
- The output has exactly one solution.
- `generate({ seed, difficulty })` called twice returns identical output. This is the
  determinism guard. It must never be skipped or marked flaky.
- The bundled starter puzzle in `starter.ts` satisfies every property above.

### 13.4 Generator tests, slow suite

`generate.slow.test.ts`, run by `vitest.slow.config.ts` in `slow.yml`. 100 seeds per
difficulty. Assert every property in section 13.3, and additionally:

- **Achieved mask density is within 10 percentage points of target**, for both digits
  and operators, at every difficulty. This is the assertion that catches Hard
  silently collapsing into Medium because uniqueness forced too many cells back.
- Generation succeeds within the attempt cap for at least 99% of seeds.

Record median and worst attempts, median and worst milliseconds, and achieved mask
density per difficulty into `.learnings/generation-measurements.md`.

### 13.5 Worker and client tests

- `GenerateClient` resolves the promise for a completed request.
- A cancelled request resolves with reason `cancelled` and the worker stops work.
- An exhausted attempt cap resolves with reason `exhausted`, not a rejection.
- Two concurrent requests resolve independently and are not confused by request id.
- `drawSeed` uses `crypto.getRandomValues`.
- Pre-generation is cancelled when the player changes difficulty, per section 5.8.

### 13.6 State, persistence and daily tests

- Undo reverts exactly one cell entry. Redo reapplies it. A new move truncates redo.
- The history caps at 200 moves and the oldest is dropped, not the newest.
- Undo history survives a save and reload.
- Starting a free-play puzzle leaves the daily slot untouched.
- A corrupt or missing value in either slot yields a default rather than a throw.
- On a new UTC date, an unfinished previous daily is discarded and the player is
  told.
- A streak increments only on same-UTC-date completion, and a missed day resets it.
- A completed daily recorded by date key survives a change to `GENERATOR_VERSION`.
- The timer pauses on `visibilitychange` and resumes afterwards.

### 13.7 Integration and accessibility tests

Drive one puzzle to completion through the DOM: focus a cell, enter a digit, move to
an operator cell, enter an operator, assert the solved state. Cover a multi-cell
number, undo, and the Android back button path.

Assert the board exposes `role="grid"`, that every cell has an `aria-label` naming
its number and equations, and that equation state is reflected in a non-colour
attribute as well as a class.

Note the sibling's `service-worker-unverifiable-in-pane.md`: the in-app browser pane
cannot register a service worker, so a passing build is not evidence of offline
capability. Verify offline behaviour on a real browser or device.

### 13.8 Regression tests

Every fixed bug must gain a test that fails before the fix and passes after it.

## 14. Milestones

Each milestone ends with tests passing in CI.

- **M0 — Foundations.** Repository scaffolded from the sibling's shape:
  `package.json`, `tsconfig.json`, the two Vite configs, the two Vitest configs,
  `README.md`, `.learnings/`, `ci.yml`, `pages.yml`, `slow.yml`.
  `tokens.css` and `layout.css` copied with the accent changed and `--colour-note`
  removed. A blank page builds for both targets. `.gitignore` and `.gitattributes`
  are already committed.
- **M0.5 — Paper playtest. A gate, not a milestone.** See section 14.1. M1 may start
  in parallel, but **M2 must not begin until M0.5 passes.**
- **M1 — Engine core.** `types.ts`, `difficulty.ts`, `rng.ts`, `grid.ts`, `parse.ts`,
  `evaluate.ts`, `solver.ts`, `test-fixtures.ts`. The section 2.8 fixture parses and
  evaluates. All section 13.1 tests pass, including the length-one run case. Record
  the accepted derived ranges from section 2.6 in `.learnings/`.
- **M2 — Generation.** `mesh.ts` including operand widths, `fill.ts`, `mask.ts`,
  `generate.ts`, `generate.worker.ts`, `game/generate-client.ts`, `starter.ts`. Fast
  and slow suites pass for Easy. Run the slow suite, set the attempt cap and the
  `slow.yml` wall-clock ceiling from the result, and write
  `.learnings/generation-measurements.md`.
- **M3 — Playable web.** Board rendering, the grouping cue, focus, the numeric pad,
  per-equation feedback with a non-colour channel, completion detection, the
  generating state with progress and cancel, undo and redo, the timer, the
  first-run explainer from section 8.7, and the accessibility work from section 8.8.
  The touch-response rules from section 8.3. Easy only. Measure the bundle, tighten
  the section 8.4 ceilings, and add the size gate to `ci.yml`.
- **M4 — Difficulty breadth.** Medium and Hard generation. Negative values, division,
  the operator pad, operator masking. Settle Hard's operator masking percentage from
  the M0.5 result and the mask-density assertion.
- **M5 — Persistence, daily, PWA.** The two slots, resume with undo intact, stats per
  section 7.3, settings, the four themes, daily seeding and UTC rotation, streak
  semantics per section 7.4, the service worker with the prompt-to-update flow, the
  icon from section 9.5.
- **M6 — Cordova and Android.** `native/` project with the origin preferences from
  section 9.2, touch entry, the back button, safe areas, permission removal, CSP,
  `release.yml` producing a signed AAB. Verify `localStorage` survives an app restart
  and upgrade on a device. Verify tap latency on a device. Measure the installed app
  size and set the real ceiling. Record the Cordova-over-Capacitor decision and its
  trigger conditions in `.learnings/`.
- **M7 — Release hardening.** Low-end device testing. Store assets per section 9.6:
  generate the drawn pair, capture all three screenshot sets from the finished UI,
  write `store/listing.md`, publish `privacy.html` to Pages, and answer the Data
  Safety and content-rating questionnaires. First manual Play submission.

### 14.1 M0.5 — the playtest gate

The plan commits M1 and M2 to a parser, an evaluator, a solver, a mesh generator, a
fill, a mask and a worker before any human plays anything. The risk is concrete:
cross-sums may be tedious rather than satisfying, and
discovering that after the most expensive work in the plan is finished would be the
worst possible order.

**The test.** Hand-author boards on paper or in a text file — one Easy, one Medium,
one Hard with every operator blank — and solve them yourself. It costs about an hour,
needs no code, and it produces test fixtures that section 13 needs anyway.

**The criterion.** Pass means you would voluntarily play a third.

**On failure:**

- If **Easy** fails, stop. Do not write engine code for a mechanic that is not
  enjoyable at its gentlest. Consider the pivot in section 14.2.
- If only **Hard** fails, that is a tuning result and not a kill. Lower the operator
  masking percentage in section 2.7 and continue.

Write the outcome into `.learnings/` either way. A rejected mechanic is worth more
written down than forgotten, and a passing playtest is the justification for
everything after it.

### 14.2 The pivot, if M0.5 fails on Easy

The pivot is **operator placement**, the variant in the original specification: the
grid arrives pre-filled with numbers and blank operator cells, and the player inserts
`+`, `-`, `*`, `/` to make every equation valid. It has a much smaller search space
and a different feel.

The useful and non-obvious fact is how little would be lost. Roughly three quarters
of this plan is mechanic-independent.

**Survives untouched:** the repository layout, both Vite configs, all four workflows,
`rng.ts`, `grid.ts`, `parse.ts`, `evaluate.ts`, the worker and client, persistence
and both slots, stats and streaks, theming, onboarding, accessibility, every
touch-response decision, the bundle ceilings, the icon, and the entire native shell.

**Invalidated:** operand cell widths in section 5.1, the value fill in section 5.2,
the digit-masking rules in section 5.4, and multi-cell numbers in section 2.2 —
because operator placement pre-fills the numbers, so `--colour-group` and the
grouping cue go with them.

That is three engine files and one CSS token. Writing this down converts a
frightening-sounding failure into a costed one.

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The mechanic is not enjoyable | Every milestone after M2 is wasted | M0.5 gates M2, with a defined criterion and a costed pivot. Sections 14.1 and 14.2 |
| Hard's 100% operator masking is unsolvable or unfun | The top of the difficulty ladder is unusable | Demoted to a hypothesis in section 2.7, tested by hand at M0.5, expected to settle at 60 to 70% |
| Uniqueness forces so many cells back that Hard becomes Medium | The ladder silently collapses and nobody notices | Achieved mask density reported by the generator and asserted within 10 points in section 13.4 |
| Generation cost is dominated by a narrow acceptance band, as in the sibling | Long waits or exhausted caps | Worker with progress and cancel, attempt cap, measured at M2, band widened before code is optimised. Section 5.6 |
| A new player reads `1 5` as two operands rather than fifteen, and concludes correct answers are being rejected | Uninstall on first play | The grouping cue in section 8.5 and the first-run explainer in section 8.7, both built at M3 |
| The first board on a fresh install makes the player wait | Uninstall before the first puzzle | Bundled starter puzzle and background pre-generation. Section 5.8 |
| Operand cell widths disagree at an intersection | Generator emits unsolvable or misparsed puzzles | Width consistency asserted at the end of phase 1 and property-tested in section 13.3 |
| The mesh legality rules are misread again | No valid 5 x 5 grid exists, or the reference board is rejected | Both rules restated in sections 2.4 and 5.1 with the failure spelled out, plus the explicit test in section 13.1 |
| Left-to-right association *within* a precedence tier is implemented right-to-left, or a division is reordered to make it exact | Puzzles silently accept wrong answers or reject right ones, and only in equations with two same-tier operators — which only Hard can produce | The three association and exactness tests in section 13.1, which no other test in the suite would catch |
| A maths game contradicts school arithmetic | A child is told correct arithmetic is wrong, or learns a rule they must later unlearn | BODMAS, per section 2.5. Not negotiable, and the reason is recorded there so it is not traded away for convenience later |
| Multi-cell numbers are not visually grouped | Players misread `1 5` as two operands and think correct answers are rejected | The grouping cue in section 8.5, tested at M3 against the fixture board |
| Equation state is conveyed by colour alone | Unusable for colour-blind players, and it is a three-state distinction | A second non-colour channel, required by section 8.8 and asserted in section 13.7 |
| Accessibility is deferred to M7 | Retrofitting a grid widget costs several times building it right | Pulled forward into M3. Section 8.8 |
| The timer runs while the app is backgrounded | Every time-based stat is worthless | Pause on `visibilitychange` and the Cordova pause event. Section 7.3 |
| A half-finished daily is destroyed by a free-play game | A streak breaks through no fault of the player | Two separate slots, and free play never touches the daily. Section 7.1 |
| The native shell is served from `file://` | `localStorage` silently lost on app upgrade | The explicit preferences in section 9.2 and a device restart-and-upgrade check at M6 |
| A torn `localStorage` write leaves inconsistent state | Corrupt stats or a lost board presented as a crash | One JSON value per key, separate keys per slot, version fields, reads that return defaults. Section 7.2 |
| iOS web players lose progress to the 7-day eviction | Silent loss of streaks | Documented, not fixed: IndexedDB would not fix it, and home-screen installs are exempt. Section 7.2 |
| The 300 ms WebView tap delay is left in place | The game feels unresponsive | `touch-action: manipulation` and the rest of section 8.3, verified on a device |
| A dependency added without weighing it inflates the bundle | Slower download, larger install | The ceilings and CI gate in section 8.4 |
| The slow suite makes every push slow | CI becomes something to avoid | Moved to nightly, tags, and manual dispatch, with a wall-clock ceiling. Section 10.4 |
| The first tag deploy is rejected by the `github-pages` environment | A release ships no web build | Add the tag rule before the first tag |
| Screenshots captured at the wrong CSS viewport show a small board in an empty frame | The listing makes the game look broken, or Play rejects the aspect ratio | Phone-sized CSS viewport at DPR 2, never a 1080 px CSS width. Verify every file's real dimensions after capture. Section 9.6 |
| Play rejects the submission on an asset size or a missing declaration | The release stalls at the last step | Sizes and declarations listed in section 9.6 and re-checked against Play Console before submission, since Play changes requirements |
| The store icon drifts from the installed icon | The listing and the home screen disagree | `store/icon-512.png` is copied from `public/icons/`, never redrawn. Section 9.6 |
| Cordova maintenance stalls on a future Android API level | Blocked Play Store updates | Minimal plugin list, wrapper-agnostic bundle, four switch triggers in section 9.1 |

## 16. Decisions taken

No open question blocks any milestone. Every decision this plan depends on is taken
and recorded in the section named below.

| Question | Decision | Section |
|---|---|---|
| Project purpose | Hobby and portfolio. No revenue, no deadline | 1.1 |
| Core mechanic | As specified, gated by a playtest before the generator is built | 2, 14.1 |
| One digit or one integer per cell | One digit | 2.1 |
| Multi-digit number bounds | Maximal run of adjacent digit cells | 2.2 |
| Negative representation | Unary minus, by cell position | 2.3 |
| Grid legality | Every non-block cell in an equation; every equation has an operator | 2.4 |
| Parallel equation spacing | Not in adjacent rows or columns; no block-row requirement | 5.1 |
| Degenerate equations | Illegal | 2.4 |
| Value ranges | Derived from equation length; original figures unreachable and accepted | 2.6 |
| Kids tier | Deferred to release 2 | 1.5, 17 |
| Easy grid size | 5 x 5, and the entry point | 2.7 |
| Hard operator masking | 100% is provisional, to be settled at M0.5 and M4 | 2.7 |
| Negative values by difficulty | Off at Easy, on at Medium and Hard | 2.7 |
| Undo | In scope. 200 moves, single-cell, persisted | 8.6 |
| Mistake counting | Out of scope. Not definable for this mechanic | 1.5 |
| Pencil marks | Out of scope; `--colour-note` deleted | 1.5, 8.1 |
| Onboarding | First-run explainer for multi-cell numbers | 8.7 |
| Animation | One reduced-motion-gated completion transition, nothing else | 8.3 |
| Accessibility timing | Pulled forward from M7 into M3 | 8.8 |
| First launch | Bundled starter puzzle plus background pre-generation | 5.8 |
| Storage API | `localStorage`, one JSON value per key | 7.2 |
| In-progress slots | Two: free play and daily | 7.1 |
| Stats | Completions only; median times; streaks by date key | 7.3 |
| Daily generator version | No frozen version. Persist the board, record dates | 5.7 |
| Stale daily | Discarded on a new UTC date, with notice | 7.4 |
| Slow suite trigger | Nightly, tags, and manual, not per pull request | 10.4 |
| Wrapper | Cordova, confirmed against Capacitor, four switch triggers | 9.1 |
| Package identifier | `com.bizzeh.mathscross`, permanent | 9.4 |
| Parental gate | None. The audience is general adult players | 9.4 |
| Repository and Pages path | `mathscross` | 1.2 |
| Accent | Indigo `#3a5fa8` / `#8fb0f0` | 8.1 |
| Icon | Cell fragment with `+` and `=`, hand-authored SVG | 9.5 |
| Store assets | Drawn pair generated, screenshots captured from the real UI | 9.6 |
| Data Safety | No data collected, no data shared. Provable via the absent permission | 9.6 |
| Daily difficulty | Rotates by UTC day of week | 5.7 |
| Documentation | `README.md` and `.learnings/`. No `docs/` | 3.2 |

### 16.1 Deferred to a measurement

Each has a stated default and a milestone at which a measurement replaces it. Do not
decide these early by guessing.

1. **The attempt cap.** Default 5000, from the sibling's corrected value. M2 measures
   100 seeds per difficulty and sets the real figure. Section 5.6.
2. **The `slow.yml` wall-clock ceiling.** Set at M2 from the measured figure plus
   headroom. Section 10.4.
3. **The bundle ceilings.** Defaults in section 8.4 are budgets, not measurements. M3
   tightens the JS and CSS figures; M6 sets the installed-app figure from the AAB.
4. **Hard's operator masking percentage.** 100% provisionally. M0.5 tests it by hand
   and M4 settles it. Section 2.7.
5. **Whether mesh caching is needed.** Held in reserve. Build it only if M2 shows a
   difficulty cannot meet its attempt cap. Section 5.6.

### 16.2 Re-check on a scope change

1. **The parental gate and the families declaration**, if the Kids tier arrives in
   release 2, or if any release adds an external link, ads, or purchases.
2. **The storage API**, if iOS ships, if stored state approaches 2 MB, or if
   statistics grow into a queryable history. Section 7.2.
3. **The wrapper**, at any of the four triggers in section 9.1.

## 17. Release 2 backlog

Deferred deliberately, recorded here so that nothing is either forgotten or
accidentally implemented. No folder or file exists for any of these until it is in
scope.

| Item | Why deferred | What would trigger it |
|---|---|---|
| Kids tier | One digit per cell forced it to 5 x 5 single-digit, leaving it near-identical to Easy. It cost its own generation tuning, play-testing, an enlarged touch target, and the families declaration | A real child audience, or a decision to widen the ladder downward. Would likely need a mechanic tweak rather than only a parameter change, since 5 x 5 is already the minimum viable grid |
| Tile placement mode | A variant in the original specification, not the primary mechanic. Doubles the input model and the solver's job | Release 1 ships and the primary mechanic proves durable |
| Hints | Needs the solver's deduction log, which section 6.3 already records, plus a UI for revealing a single deduction rather than an answer | Player feedback that Hard is impassable rather than hard |
| Pencil marks | Sudoku needs them because a cell has nine candidates. A MathsCross digit cell has ten but far more constraint from its equations, so the value is unproven | Evidence from play that players want to record candidates. Restores `--colour-note` |
| Save codes and sharing | Needs `GENERATOR_VERSION` to be meaningful in an encoded id, which section 5.5 already preserves | A wish to share a specific board, or cross-device transfer without accounts |
| iOS build | Cordova's friction is worst on iOS and the sibling's job is unproven. Also the point at which the wrapper decision reverses | A decision to publish on the App Store. Migrate to Capacitor at the same time, per section 9.1 |
