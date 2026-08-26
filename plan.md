# MathsCross — implementation plan

## 1. Product definition

MathsCross is a minimalist, single-player, offline maths crossword. The player fills
an intersecting grid with digits and arithmetic operators so that every horizontal
and vertical equation is mathematically valid.

The game ships as a web app, installable as a PWA, and as an Android app. Both
targets build from one TypeScript codebase through two Vite configurations. Android
is wrapped with Apache Cordova. All builds and releases run through GitHub Actions.

### 1.0 Names

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

### 1.1 Sibling project

`C:\code\sudoku` is an offline-first Sudoku PWA with the same shape: seeded runtime
generation, a Cordova Android shell, GitHub Pages deployment, and Play publishing.
Its pipeline is working and its constraints are measured.

MathsCross must follow its conventions rather than invent new ones: the same folder
layout, the same theme tokens, the same two-config Vite setup, the same three
workflows, and the same native shell settings. Section 12 lists the entries in
`C:\code\sudoku\.learnings\` that apply here and must be read before the work they
govern.

Deviating from a sibling convention is allowed only with a stated reason. Six
deviations are already known and are recorded in section 11.

### 1.2 Confirmed decisions

| Decision | Choice |
|---|---|
| Frontend stack | TypeScript + Vite, no UI framework |
| Puzzle delivery | Generated on device at runtime, in a Web Worker |
| Release 1 scope | Offline single-player, plus a daily puzzle |
| Web distribution | GitHub Pages, installable as a PWA |
| Native wrapper | Cordova (`cordova-android`). Confirmed against Capacitor, section 9.1 |
| CI/CD | GitHub Actions: `ci.yml`, `pages.yml`, `release.yml` |
| Persistence | `localStorage`, one JSON value per key, behind `persist.ts` |
| Cell contents | One digit (0 to 9) per cell |
| Number bounds | A number is a maximal run of adjacent digit cells |
| Negative sign | Unary minus, identified by cell position |
| Degenerate equations | Illegal. Every equation must contain an operator |
| Negative values | Off at Kids and Easy. On at Medium and Hard |
| Audience | Both children and adults, via a Kids tier |
| Daily puzzle | Difficulty rotates by day of week |
| Theming | Sudoku's token set and four-theme model, reused |
| Value ranges | Derived from equation length, not from the original specification |
| Easy grid | Stays 5 x 5. Kids and Easy share a grid size |
| Package identifier | `com.bizzeh.mathscross`. Permanent once published |
| Repository and Pages path | `mathscross`, so `APP_BASE` is `/mathscross/` |
| Accent | Indigo. `#3a5fa8` light, `#8fb0f0` dark, `#ffd400` contrast |
| Parental gate | None. Nothing in release 1 requires one |

### 1.3 Out of scope for release 1

Do not build any of the following in release 1:

- Tile Placement mode. It is a specified variant, deferred to release 2. Fill Mode
  is the only mode in release 1.
- Accounts, cloud sync, or any backend service.
- Ads, in-app purchase, or store billing.
- Analytics or crash reporting that transmits data off device.
- iOS release builds. The `ios` job exists in `release.yml`, disabled, matching the
  sibling.
- Multiplayer or leaderboards.

### 1.4 Success criteria for release 1

1. The web app is playable with no network connection after first load.
2. The Android app requests no `INTERNET` permission.
3. The main thread never blocks on generation. A generating state appears within
   150 ms, reports progress, and can be cancelled.
4. Generation succeeds within the attempt cap for at least 99% of seeds at every
   difficulty, measured over 100 seeds per difficulty in the slow suite.
5. Every generated puzzle has exactly one solution.
6. The daily puzzle for a given date is identical on every device and platform.
7. `localStorage` survives an Android app restart and upgrade, verified on a device.
8. A tap on a board cell or a keypad key registers with no perceptible delay,
   verified on a device rather than in a desktop browser.
9. The installed Android app is at or under the ceiling measured in section 8.4.
10. Unit and slow tests pass in CI on every pull request.

Criterion 3 and 4 replace a flat wall-clock budget. Section 5.6 explains why a
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
ambiguous cell. This holds even at Hard, where every operator is masked.

### 2.4 Equations

An **equation** is a maximal contiguous horizontal or vertical run of non-`block`
cells that contains at least one `equals` cell. Runs are bounded by `block` cells or
by the grid edge.

These states are illegal and the generator must never produce them:

- A run of non-`block` cells containing no `equals` cell.
- An isolated single non-`block` cell.
- An equation containing no `operator` cell. A bare identity such as `6 = 6` gives
  the player nothing to deduce.

### 2.5 Evaluation rule

Evaluation is strictly left-to-right for horizontal equations and strictly
top-to-bottom for vertical equations. Operator precedence is ignored.

```
5 + 3 * 2 = 16      evaluated as (5 + 3) * 2
```

Ignoring precedence is deliberate. It keeps mental arithmetic tractable on a phone
screen. Do not implement PEMDAS. Do not add parentheses.

An equation is satisfied when each side of the `=` evaluates to the same value, with
each side evaluated in reading order.

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

Two consequences follow from that decision:

1. **Easy's stated range of 1 to 20 is unreachable.** Easy is 5 x 5 with equations
   of 3 to 5 cells, so every operand and result is a single digit. Easy's real range
   is 0 to 9.
2. **Medium's stated maximum of 100 is unreachable.** Medium is 7 x 7 with equations
   of at most 7 cells, which caps a result at 99.

Neither is a defect. Record both in `.learnings/` during M1, so a later reader who
compares the difficulty table against the original specification does not treat the
difference as a bug and "fix" it.

### 2.7 Difficulty parameters

Hold this table in one place, `src/engine/difficulty.ts`. Do not spread these values
across the generator, the solver, and the UI.

| Parameter | Kids | Easy | Medium | Hard |
|---|---|---|---|---|
| Grid dimensions | 5 x 5 | 5 x 5 | 7 x 7 | 9 x 9 |
| Equation length | 5 cells | 5 cells | 5 to 7 cells | 5 to 9 cells |
| Allowed operators | `+` `-` | `+` `-` | `+` `-` `*` | `+` `-` `*` `/` |
| Derived value range | 0 to 9 | 0 to 9 | -99 to 99 | -999 to 999 |
| Intersection count | 2 | 2 to 4 | 5 to 8 | 10 or more |
| Division | not used | not used | integer results only | integer results only |
| `allowNegative` | false | false | true | true |
| Digit masking | 30% | 40% | 60% | 75% |
| Operator masking | 0% | 0% | 30% | 100% |
| Touch target | 56px | 44px | 44px | 44px |

Notes on this table:

- **Kids is 5 x 5, not 4 x 4.** A 4 x 4 grid cannot hold any equation. The shortest
  legal equation is 5 cells, so no run in a 4 x 4 grid is long enough.
- **Easy stays at 5 x 5.** Kids and Easy therefore differ only by masking density,
  intersection count, and touch target size. The gap is narrow and accepted. If
  play-testing at M4 shows the two tiers feel identical, widen the gap by lowering
  Kids masking and raising Easy masking and intersection count, within the same grid
  size. Do not move Easy to 7 x 7: that would leave Medium and Easy on adjacent grid
  sizes and compress the top of the ladder.
- At Hard, every operator is masked and 75% of digits are masked, so the player
  solves structure and arithmetic together. This is the intended design and is also
  the dominant driver of generation cost. Section 5.6 covers the consequence.
- The touch target row feeds `--tap-min`, per section 8.2.

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
Its nine intersections exceed the Easy range on purpose. Put it in
`src/engine/test-fixtures.ts`, matching the sibling's convention, and assert the
engine extracts the same six equations a human reads from it. This is the first test
written in M1.

## 3. Repository layout

Mirror the sibling project. The folder names below are the sibling's, not a fresh
design, so that a person moving between the two repositories finds the same things
in the same places.

```
/
  plan.md
  README.md
  AGENTS.md
  .learnings/                 # this project's own learnings
  standards/                  # copied from the sibling
  docs/
  store/                      # store listing copy and screenshots
  scripts/
    generate-icons.mjs
    generate-store-assets.mjs
  public/                     # static assets, copied verbatim
  src/
    index.html                # Vite root is src/, per the sibling
    main.ts
    vite-env.d.ts
    styles/
      tokens.css              # copied from the sibling, accent changed
      layout.css
    engine/                   # pure. No DOM, no platform calls, no clock
      types.ts
      difficulty.ts           # the single difficulty parameter table
      rng.ts                  # seeded deterministic PRNG
      grid.ts
      parse.ts                # grid -> equations, numbers, sign classification
      evaluate.ts             # left-to-right evaluation, validation states
      mesh.ts                 # phase 1: skeletal mesh, operand cell widths
      fill.ts                 # phase 2: operator and value fill
      solver.ts               # phase 3: DFS with forward checking, uniqueness
      mask.ts                 # phase 4: cell masking
      generate.ts             # orchestrates phases 1 to 4
      generate.worker.ts      # worker entry point
      generate.test.ts
      generate.slow.test.ts   # 100 seeds per difficulty, own vitest config
      test-fixtures.ts
    game/                     # in-progress game state, main thread
      generate-client.ts      # owns the worker, draws seeds, returns promises
      state.ts
      validate.ts
      persist.ts
      timer.ts
      hint.ts                 # deferred past release 1, file reserved
    features/
      daily/                  # date -> seed, difficulty rotation, streak
      settings/
      stats/
      theme/                  # applyTheme, effectiveTheme, THEME_LABELS
      savecode/               # deferred past release 1
    ui/
      app.ts
      platform.ts             # native detection, service worker gating
      board/
      keypad/                 # numeric pad and operator pad
      controls/
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
   - Parallel adjacent equations are forbidden. Leave at least one `block` cell
     between two parallel equations.
   - The graph of connected equations must form a single connected component.
   - The intersection count must fall in the difficulty's range.
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
2. Mask cells one at a time, in seeded random order, up to the targets.
3. After each mask, re-run the uniqueness check. If uniqueness is lost, restore that
   cell and continue with the next candidate.
4. Stop when the targets are met or the candidate list is exhausted.

Masking a `digit` cell that holds the leading digit of a multi-cell number is legal.
The no-leading-zero rule in section 2.2 then becomes a solver constraint on that
cell, pruning its domain to 1 to 9.

Masking percentages are targets, not guarantees. A puzzle reaching 70% digit masking
at Hard instead of 75% is acceptable. A puzzle with two solutions is not. Uniqueness
always wins.

Note the sibling's finding in `generation-measurements.md`: its hole-digging stopped
at the floor of its target range, so clue counts carried no variety. Expect the same
here, and treat the masking percentage as a floor rather than a target if variety
turns out to matter.

### 5.5 Determinism

Determinism is a hard requirement, because the daily puzzle must match across
devices with no server to arbitrate.

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

### 5.6 Cost model and the attempt cap

An earlier draft of this plan set a 300 ms wall-clock budget at the 95th percentile.
The sibling's measurements show that is the wrong shape, and the number is not
achievable.

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
4. **Measure before tuning.** M2 runs `test:slow` over 100 seeds per difficulty and
   records median and worst attempts, median and worst milliseconds, and achieved
   mask density per difficulty into `.learnings/generation-measurements.md`. Set the
   cap from that table, not from a guess.
5. If a difficulty's median exceeds 1000 ms after measurement, widen its acceptance
   band before optimising code. A narrow band is the usual cause, per the sibling's
   finding.

One optimisation is held in reserve and must not be built before measurement shows
it is needed: cache verified skeletal meshes, including operand widths, and run only
phases 2 to 4 at runtime. This removes the most expensive search while keeping
generation on device and puzzles effectively unlimited.

### 5.7 Daily puzzle seeding and rotation

The daily seed derives from the UTC date and a frozen generator version:

```
seed = hash(`${utcDateISO}:${DAILY_GENERATOR_VERSION}`)
```

Difficulty rotates by day of week, derived from the date so it needs no network and
matches on every device:

| Day | Difficulty |
|---|---|
| Monday | Easy |
| Tuesday | Easy |
| Wednesday | Medium |
| Thursday | Medium |
| Friday | Medium |
| Saturday | Hard |
| Sunday | Hard |

The Kids tier is excluded from the rotation. Kids puzzles are available in free play
only.

`DAILY_GENERATOR_VERSION` is a constant in `src/features/daily/`. Any change to
generation logic that alters output must be handled as follows:

- Bump `GENERATOR_VERSION` for free play. Free play has no cross-device parity
  requirement.
- Leave `DAILY_GENERATOR_VERSION` unchanged, or accept that every past daily
  changes. Changing it is a deliberate release decision and must be recorded in
  `.learnings/`.

This constraint follows from choosing runtime generation over bundled packs. Record
it in `.learnings/` during M2 so it is not rediscovered during a later refactor.

## 6. Solver

### 6.1 Callers

The solver serves three callers: the phase 2 fill, the phase 3 and 4 uniqueness
checks, and the hint feature, which is deferred past release 1.

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

Use the log for two purposes. First, to confirm a generated puzzle is solvable by
deduction rather than only by brute force. Second, as an input to a future hint
feature. The log is not the difficulty grade. The table in section 2.7 sets that.

## 7. Persistence

### 7.1 What is stored

- Define a storage interface in `src/game/persist.ts`, following the sibling's
  `game/persist.ts`.
- Persist the current puzzle state, per-puzzle completion records, the daily streak,
  and settings. Persist nothing else.
- **Do not persist the solution.** The sibling's `solution-concealment.md` records
  that a solution cannot be hidden from a determined client-side reader, because it
  follows from the visible givens. What is achievable is keeping it out of storage,
  so a casual inspection does not hand it over. Store the mesh, the givens, and the
  player's entries; recompute the solution when a hint or a check needs it.
- Do not persist personal data. Do not persist anything identifying a device or a
  person. This matters more given a child audience: collect nothing.

### 7.2 Which storage API

`localStorage` for release 1, behind the interface in `persist.ts`. The reasoning
below matters because the obvious upgrade does not fix the problem it appears to
fix.

**The premise to correct.** A common claim is that iOS WebViews clear
`localStorage` under memory pressure, and that IndexedDB avoids it. The documented
mechanism is different, and IndexedDB does not avoid it. On iOS, Intelligent
Tracking Prevention deletes **all script-writable storage** after 7 days without
site interaction. That bucket includes IndexedDB, Cache API, and service worker
registrations alongside `localStorage`. Moving to IndexedDB, with or without
`localForage`, changes nothing about eviction. See the sibling's
`ios-storage-eviction.md`.

What each option actually buys:

| Option | Buys | Does not fix |
|---|---|---|
| `localStorage` | Simplest. Synchronous. Matches the sibling | Atomicity across keys. ~5 MB quota |
| IndexedDB, via `localForage` | Large quota, structured values, transactional writes | iOS 7-day eviction. Adds a dependency |
| Cordova SQLite plugin | Durability: a native file outside the WebView storage bucket, so eviction cannot reach it | Nothing, but it is native code and a supply-chain surface, and it does not exist on the web target |

**The decision.** MathsCross state is small: a mesh, a given set, a player entry set,
a streak counter, and a settings object. That fits `localStorage` with room to
spare, and the Android shell's `https://localhost` origin from section 9.2 makes it
durable there. Release 1 ships no iOS native build, so the eviction risk applies
only to web players on iOS who have not installed to the home screen, and
home-screen installs are exempt.

**The atomicity weakness is real and must be handled.** `localStorage` has no
transaction, so a multi-key write can tear if the app is killed mid-write, leaving
inconsistent state. Handle it without changing API:

- Write each domain object as one key holding one JSON value. Never spread one
  object across several keys.
- Write the in-progress puzzle under a single key, so a torn write loses the puzzle
  rather than corrupting the stats.
- Every read must tolerate missing or corrupt data and return a default. Treat a
  read failure as an expected failure and return a value; do not throw. A `JSON.parse`
  failure is a normal case here, not an exception.
- Version every stored shape with a `v` field, so a later format change can migrate
  or discard rather than misread.

**When to revisit.** Move off `localStorage` if any of these becomes true:

1. An iOS native build is added. Then durability needs a native file, so use the
   SQLite plugin or `cordova-plugin-file` — not IndexedDB, which evicts identically.
2. Stored state approaches 2 MB, half the practical quota. Then use IndexedDB for
   capacity.
3. Statistics grow into a per-puzzle history worth querying rather than a set of
   counters. Then use IndexedDB for structured access.

Because `persist.ts` is the only module that touches the storage API, any of these
changes is confined to one file. Do not scatter storage calls through features.

## 8. UI, input and theming

### 8.1 Theme tokens

Copy `src/styles/tokens.css` from the sibling. Keep the same custom property names,
the same scale, and the same four-theme model: `system`, `light`, `dark`, and
`contrast`, selected by a `data-theme` attribute on the root, with
`prefers-color-scheme` as the default.

Copy `src/features/theme/theme.ts` behaviour exactly, including the detail that
`system` removes the attribute rather than setting `data-theme="system"`. Setting a
`system` value matches no rule and silently yields the light palette.

Change one token. MathsCross must not look like the same app as Sudoku on a home
screen or in a task switcher, so the accent differs:

| Token | Sudoku | MathsCross |
|---|---|---|
| `--colour-accent` light | `#2f6f4f` | `#3a5fa8` |
| `--colour-accent` dark | `#6fbf95` | `#8fb0f0` |
| `--colour-accent` contrast | `#ffd400` | `#ffd400` (unchanged) |

Keep the contrast theme's accent unchanged. It is chosen for contrast, not for
brand, and the sibling's comment records that raising contrast is not the same as
inverting a palette.

Every surface, ink, and line token stays identical. Verify the new accent against
`--colour-surface-raised` in all three palettes and record the measured ratio in a
comment, matching how the sibling documents `--colour-note` at 7.51:1.

MathsCross needs one token the sibling does not: a grouping colour for multi-cell
numbers, per section 8.5. Add `--colour-group` beside `--colour-note` and define it
in all three palettes.

### 8.2 Layout

Follow `src/styles/layout.css` from the sibling:

- Pad `#app` on all four edges with `env(safe-area-inset-*)`, not just the bottom.
  An app targeting SDK 35 or above is drawn edge to edge on Android 15 whether it
  asks to be or not, and in landscape the large inset is the left or right one.
- Use aspect ratio, not width, as the single layout trigger. A landscape phone at
  844 x 390 is narrow and short, so a width rule would give it the stacked layout,
  which cannot fit a header, a square board, controls, and a keypad in 390 px of
  height.
- Size all controls from `--tap-min`.
- Give `:focus-visible` a 3 px accent outline.

MathsCross deviates on one point. `--tap-min` is 44 px in the sibling and here, except
at the Kids tier, where section 2.7 sets 56 px. Set it by a `data-tier="kids"`
attribute that redefines the token, rather than by overriding individual control
sizes.

### 8.3 Touch response inside the WebView

A WebView delays a tap by roughly 300 ms while it waits to see whether a second tap
is coming, which would be a double-tap zoom. That delay is the single largest reason
a web-stack game feels unlike a native one. Remove it explicitly rather than hoping
a viewport setting covers it.

- Set `touch-action: manipulation` on every interactive element: board cells, keypad
  keys, and `.button`. It disables double-tap zoom on that element while leaving
  scrolling and pinch-zoom on the page intact. Prefer it over
  `user-scalable=no` in the viewport meta, which disables pinch-zoom for everyone and
  is an accessibility regression.
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

Verify touch feel on a device, not in a desktop browser with touch emulation. The
tap delay does not reproduce there.

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
- The installed-app figure is dominated by the native shell and the WebView glue, not
  by the web bundle, so shrinking JS by 20 KB will not move it. Measure the AAB at M6
  and set the real ceiling from that, then hold it.
- Runtime generation is what keeps the app small. Bundled puzzle packs would have
  added megabytes; this design ships an algorithm instead. That is a size argument in
  favour of the choice already made in section 1.2.
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
  Per-equation feedback comes from section 2.4.

### 8.6 Input

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
- Reuse the sibling's `ui/haptics.ts` for entry and completion feedback.

## 9. Cordova and Android

### 9.1 Cordova or Capacitor

**Decided: Cordova.** Confirmed after the comparison below, not by default. Do not
reopen this without one of the four triggers at the end of this section. The
comparison is recorded because a decision to keep the older tool is worth less than
nothing if the reasoning behind it is lost.

The friction with Cordova is real and is exactly where it is described: keeping the
native wrapper aligned with current Play Store target API levels, Gradle toolchains,
and splash screen APIs. Capacitor uses the same web stack and would be the default
choice for a new project with no existing native pipeline.

**Why Capacitor is the better tool.** Five reasons, in descending order of weight
for a project of this shape:

1. **The native project is source, not build output.** Cordova regenerates
   `platforms/android` from `config.xml`, so that directory is disposable and must
   not be edited. Every native change has to be expressed indirectly: a `<preference>`,
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
   plugin, and it is the one Capacitor advantage that maps onto a specific weakness
   already recorded in this plan.
5. **A secure origin is the default, not a setting.** Capacitor serves from
   `https://localhost` on Android and `capacitor://localhost` on iOS out of the box.
   Cordova reaches the same place, but only through the three preferences in section
   9.2, and its `file://` mode remains available as a silent footgun — which is why
   the sibling had to write `native-shell-origin.md` at all.

**Where Cordova wins here, which is why the answer is still Cordova for now.** These
are not rationalisations; they are real and they are specific to this project:

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

Verify the current state of both projects before acting on this section at M6. The
comparison above reflects the general shape of the two tools, not a check of their
latest releases, and release cadence is one of the things being weighed.

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

No trigger applies to release 1. Record this decision in `.learnings/` during
M6, with the trigger conditions, so it is not relitigated from scratch.

Do not partially migrate. The web bundle is already wrapper-agnostic: the only
wrapper-aware code is `ui/platform.ts` and the `__NATIVE_SHELL__` define from section
4. Keep it that way, and a future switch touches `native/`, `release.yml`, and one
Vite setting.

### 9.2 The native shell must have an origin

Do not serve the bundle from `file://`. The sibling's `native-shell-origin.md`
records why: under `file://` there is no origin, so the WebView does not guarantee
`localStorage` across app restarts or upgrades, and the page is not a secure
context, which removes `navigator.clipboard` and `navigator.serviceWorker` entirely.
The storage failure is silent, which is what makes it dangerous.

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

MathsCross keeps stats, settings, the completed-seed set, and the in-progress puzzle
in `localStorage`, with no server to recover any of it from. Losing the origin loses
the player's history.

### 9.3 Plugins

Keep the plugin list minimal. Every plugin is native code and a supply-chain
surface. Do not add one without stating the current problem it solves. Match the
sibling's set unless a stated need differs.

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
- The store display name is `MathsCross`, per section 1.0.
- No parental gate. A gate exists to guard external links, ads, or purchases, and
  release 1 has none, collects no data, and requests no `INTERNET` permission. There
  is nothing behind a gate to protect. Re-check if release 2 adds any of the three.
- A child audience brings Play Store obligations. Complete the Play Console families
  declaration and confirm the listing's target age group before submission. The app
  collects and transmits no data, which makes the declaration straightforward, but it
  must still be filed.

## 10. GitHub Actions pipelines

Three workflows, matching the sibling's split and triggers. Node 20 in all three.

### 10.1 `ci.yml` — pull requests and pushes to `main`

1. Checkout.
2. Set up Node 20 with the npm cache.
3. `npm ci`.
4. `npm run typecheck`.
5. `npm test`.
6. `npm run test:slow`. The slow suite covers 100 seeds per difficulty and is
   separate because a constrained difficulty can need many attempts.
7. `npm run build`.
8. `npm run build:native`. The native bundle builds from the same source through a
   second config, so a change can break it while the web build still passes. It costs
   seconds and is the only step that would catch that.

`permissions: contents: read`. The workflow must fail if any step fails.

### 10.2 `pages.yml` — on a `v*` tag

Pages deploys on tags, not on pushes to `main`. Pushes to `main` build and test in
`ci.yml` only. This is the sibling's arrangement and MathsCross follows it.

1. Checkout with `fetch-depth: 0`, so `git describe` can stamp the version.
2. Set up Node 20. `npm ci`. Typecheck. Unit tests.
3. `actions/configure-pages`, and pass its `base_path` output as `APP_BASE` to the
   build. A project repository serves from `/<repo>/`, so every asset path, the
   manifest scope, and the service worker scope must carry it. A custom domain
   resolves to `/`.
4. Upload `dist` and deploy.

Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group
`pages` with `cancel-in-progress: false`, so a tag pushed during a deploy still
publishes.

Before the first tag, add a tag rule to the `github-pages` environment. The
sibling's `github-pages-tag-deploys.md` records that a tag-triggered deploy is
rejected until that rule exists.

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
   so `1.0.100` and `1.1.0` both produce `10100` and the second upload is rejected
   as not an increase. Fail the build if minor or patch reaches 1000.
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

- Never commit a keystore, a password, or a signing config containing a secret. Copy
  the sibling's `.gitignore` block covering `*.p12`, `*.pfx`, `*.jks`, `*.keystore`,
  `*.base64`, and `build.json`, anywhere in the tree.
- Never echo a secret to the log.
- Derive the app version from the git tag. Do not maintain a hand-edited version in a
  second place.
- Read the sibling's `play-app-signing.md` before touching the signing secrets.
  "Releases are signed by Google Play" does not remove the need for an upload key,
  and the APK CI builds is not the one users get.
- The first Play upload must be manual. Google requires it, and a personal developer
  account may need a 14-day closed test before production access is granted. Set the
  `PLAY_TRACK` variable to `internal` in the meantime.

## 11. Deviations from the sibling

Six, each with a reason. Any further deviation must be added here with its reason.

1. **`--colour-accent` differs.** Two apps from the same author with the same accent
   are hard to tell apart in a task switcher. Section 8.1.
2. **`--tap-min` is 56 px at the Kids tier.** Sudoku has no child audience. Section
   8.2.
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
   not exist until M6 and one list is easier to keep correct than two. If `native/`
   ever gains ignores specific to a local workflow, split it then.

## 12. Sibling learnings that apply

Read the entry before the work it governs. Copy each into this repository's
`.learnings/` once verified here, rather than relying on a cross-repository path.

| Entry | Read before |
|---|---|
| `native-shell-origin.md` | touching `native/config.xml` or the native base path |
| `generation-measurements.md` | changing generation or the attempt cap |
| `github-pages-tag-deploys.md` | changing the deploy trigger, or debugging a rejected deployment |
| `play-app-signing.md` | touching signing secrets or testing a release build |
| `solution-concealment.md` | persisting anything derived from the solution |
| `ios-storage-eviction.md` | touching persistence or stats |
| `service-worker-unverifiable-in-pane.md` | verifying offline behaviour |
| `windows-vite-child-process-locks.md` | starting or stopping a dev server, or when a build fails with `EPERM` |
| `vite-root-src-module-paths.md` | driving the app from the browser console |
| `windows-npm-script-env-vars.md` | adding an npm script that needs per-run configuration |

## 13. Testing

Tests must pass before any task is reported as done.

### 13.1 Parsing and evaluation tests

- Parse the reference board in section 2.8 and assert the six expected equations are
  extracted.
- Assert `[1][5][+][3][=][1][8]` parses as `15 + 3 = 18`, not as four separate
  operands. This pins the number-bounds rule.
- Assert `[9][-][1][2][=][-][3]` parses as `9 - 12 = -3`, with the first `-` binary
  and the second a sign. This pins the unary minus rule.
- Assert `5 + 3 * 2 = 16` is satisfied under left-to-right evaluation, and that the
  PEMDAS reading `5 + 3 * 2 = 11` is not. This guards the rule most likely to be
  broken by a well-meaning refactor.
- Assert a leading zero such as `[0][5]` is rejected.
- Assert a run with no `equals` cell is reported illegal.
- Assert an equation with no `operator` cell is reported illegal.
- Assert an isolated single cell is reported illegal.

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
- The mesh forms a single connected component with no parallel adjacent equations.
- Every equation contains at least one operator.
- The output has exactly one solution.
- `generate({ seed, difficulty })` called twice returns identical output. This is the
  determinism guard. It must never be skipped or marked flaky.

### 13.4 Generator tests, slow suite

`generate.slow.test.ts`, run by `vitest.slow.config.ts`. 100 seeds per difficulty.
Assert every property in section 13.3, and record median and worst attempts, median
and worst milliseconds, and achieved mask density per difficulty. Write the table
into `.learnings/generation-measurements.md`.

### 13.5 Worker and client tests

- `GenerateClient` resolves the promise for a completed request.
- A cancelled request resolves with reason `cancelled` and the worker stops work.
- An exhausted attempt cap resolves with reason `exhausted`, not a rejection.
- Two concurrent requests resolve independently and are not confused by request id.
- `drawSeed` uses `crypto.getRandomValues`.

### 13.6 Integration tests

Drive one puzzle to completion through the DOM: focus a cell, enter a digit, move to
an operator cell, enter an operator, assert the solved state. Cover a multi-cell
number and the Android back button path.

Note the sibling's `service-worker-unverifiable-in-pane.md`: the in-app browser pane
cannot register a service worker, so a passing build is not evidence of offline
capability. Verify offline behaviour on a real browser or device.

### 13.7 Regression tests

Every fixed bug must gain a test that fails before the fix and passes after it.

## 14. Milestones

Each milestone ends with tests passing in CI.

- **M0 — Foundations.** Repository scaffolded from the sibling's shape:
  `package.json`, `tsconfig.json`, the two Vite configs, the two Vitest configs,
  `.gitignore` including the signing block, `standards/`, `.learnings/`, `ci.yml`,
  `pages.yml`. `tokens.css` and `layout.css` copied with the accent changed. A blank
  page builds for both targets.
- **M1 — Engine core.** `types.ts`, `difficulty.ts`, `rng.ts`, `grid.ts`, `parse.ts`,
  `evaluate.ts`, `solver.ts`, `test-fixtures.ts`. The section 2.8 fixture parses and
  evaluates. All section 13.1 tests pass. Record the accepted derived ranges from section 2.6 in `.learnings/`.
- **M2 — Generation.** `mesh.ts` including operand widths, `fill.ts`, `mask.ts`,
  `generate.ts`, `generate.worker.ts`, `game/generate-client.ts`. Fast and slow
  suites pass for Easy. Run the slow suite, set the attempt cap from the result, and
  write `.learnings/generation-measurements.md`. Record the daily versioning
  constraint from section 5.7.
- **M3 — Playable web.** Board rendering, the grouping cue, focus, the numeric pad,
  per-equation feedback, completion detection, the generating state with progress and
  cancel. The touch-response rules from section 8.3. Easy only. Measure the bundle,
  tighten the section 8.4 ceilings to the measurement, and add the size gate to
  `ci.yml`.
- **M4 — Difficulty breadth.** Kids, Medium, and Hard generation. Negative values,
  division, the operator pad, operator masking, the Kids touch target, the menu and
  difficulty selection. Play-test the Kids and Easy gap.
- **M5 — Persistence, daily, PWA.** Persistence with the solution excluded, resume in
  progress, stats, settings, the four themes, daily seeding and day-of-week rotation,
  streaks, the service worker with the prompt-to-update flow, icons.
- **M6 — Cordova and Android.** `native/` project with the origin preferences from
  section 9.2, touch entry, the back button, safe areas, permission removal, CSP,
  `release.yml` producing a signed AAB. Verify `localStorage` survives an app restart
  and upgrade on a device. Verify tap latency on a device. Measure the installed app
  size and set the real ceiling. Record the Cordova-over-Capacitor decision and its
  trigger conditions in `.learnings/`.
- **M7 — Release hardening.** Accessibility pass, low-end device testing, store
  assets, the Play Console families declaration, store listing, first manual
  submission.

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Generation cost is dominated by a narrow acceptance band, as it was in the sibling, and a difficulty becomes unusably slow | Long waits or exhausted caps | Attempt-capped generation in a worker with progress and cancel; measure in M2; widen the band before optimising code; mesh caching held in reserve. Section 5.6 |
| Operand cell widths disagree at an intersection | Generator emits unsolvable or misparsed puzzles | Assert width consistency at the end of phase 1; property test in section 13.3 |
| Phase 1 fails to satisfy connectivity, spacing, intersection count, and width sums together at 9 x 9 | Generation loops or returns a degenerate mesh | Attempt cap; mesh caching as the reserved optimisation |
| The native shell is served from `file://` | `localStorage` silently lost on app upgrade, and the player's history with it | The explicit preferences in section 9.2; a device restart-and-upgrade check in M6; `native-shell-origin.md` |
| A generator change silently alters past daily puzzles | Players lose streak parity and trust | Frozen `DAILY_GENERATOR_VERSION`, the determinism guard, decision recorded in `.learnings/` |
| Left-to-right evaluation is refactored into PEMDAS by a later contributor | Every existing puzzle becomes unsolvable | The explicit non-PEMDAS test in section 13.1; a comment in `evaluate.ts` stating why precedence is absent |
| Multi-cell numbers are not visually grouped | Players misread `1 5` as two operands and believe correct answers are rejected | The grouping cue in section 8.5, tested in M3 with the fixture board |
| Kids and Easy feel identical, since both are 5 x 5 single-digit | The Kids tier adds no value | Play-test at M4; widen by masking and intersection count within 5 x 5, per section 2.7 |
| MathsCross and Sudoku are indistinguishable on a home screen | Players open the wrong app | A different accent and a distinct icon. Sections 8.1 and M5 |
| The first tag deploy is rejected by the `github-pages` environment | A release ships no web build | Add the tag rule before the first tag; `github-pages-tag-deploys.md` |
| Cordova maintenance stalls on a future Android API level | Blocked Play Store updates | Keep the plugin list minimal and the web bundle wrapper-agnostic. Switch to Capacitor at either trigger in section 9.1 |
| A torn `localStorage` write leaves inconsistent state | Corrupt stats or a lost puzzle presented as a crash | One JSON value per key, a version field on every shape, and reads that return a default rather than throwing. Section 7.2 |
| iOS web players lose progress to the 7-day eviction | Silent loss of streaks | Documented, not fixed: IndexedDB would not fix it. Home-screen installs are exempt. Revisit with a native file if iOS ships. Section 7.2 |
| The 300 ms WebView tap delay is left in place | The game feels unresponsive and unlike a native app | `touch-action: manipulation` and the rest of section 8.3, verified on a device where the delay actually reproduces |
| A dependency added without weighing it inflates the bundle | Slower download, larger install | The ceilings and CI gate in section 8.4; every new dependency states its gzipped cost |

## 16. Decisions taken, and what remains

No open question blocks any milestone. Every decision this plan depends on is taken
and recorded in the section named below.

| Question | Decision | Section |
|---|---|---|
| Core mechanic | As specified: intersecting equations, left-to-right evaluation | 2 |
| One digit or one integer per cell | One digit | 2.1 |
| Multi-digit number bounds | Maximal run of adjacent digit cells | 2.2 |
| Negative representation | Unary minus, by cell position | 2.3 |
| Degenerate equations | Illegal | 2.4 |
| Value ranges | Derived from equation length, original figures unreachable and accepted | 2.6 |
| Kids grid size | 5 x 5. A 4 x 4 grid cannot hold an equation | 2.7 |
| Easy grid size | Stays 5 x 5 | 2.7 |
| Negative values by difficulty | Off at Kids and Easy, on at Medium and Hard | 2.7 |
| Storage API | `localStorage`, one JSON value per key | 7.2 |
| Wrapper | Cordova, confirmed against Capacitor | 9.1 |
| Package identifier | `com.bizzeh.mathscross`, permanent | 9.4 |
| Parental gate | None | 9.4 |
| Repository and Pages path | `mathscross` | 1.0 |
| Accent | Indigo `#3a5fa8` / `#8fb0f0` | 8.1 |
| Daily difficulty | Rotates by day of week, Kids excluded | 5.7 |

### 16.1 Deferred to a measurement

These are not open questions. Each has a stated default and a milestone at which a
measurement replaces the default with a number. Do not decide them early by
guessing.

1. **The attempt cap.** Default 5000, from the sibling's corrected value. M2 measures
   100 seeds per difficulty and sets the real figure. Section 5.6.
2. **The bundle ceilings.** Defaults in section 8.4 are budgets, not measurements. M3
   tightens the JS and CSS figures; M6 sets the installed-app figure from the AAB.
3. **Whether mesh caching is needed.** Held in reserve. Build it only if M2's
   measurement shows a difficulty cannot meet its attempt cap. Section 5.6.

### 16.2 Deferred to a play-test

1. **Whether Kids and Easy feel distinct.** Both are 5 x 5 single-digit, separated by
   masking density, intersection count, and touch target. M4 play-tests. If the gap is
   too thin, widen it within 5 x 5 rather than moving Easy to 7 x 7. Section 2.7.

### 16.3 Re-check on a scope change

1. **The parental gate**, if release 2 adds an external link, ads, or purchases.
   Section 9.4.
2. **The storage API**, if iOS ships, if stored state approaches 2 MB, or if
   statistics grow into a queryable history. Section 7.2.
3. **The wrapper**, at any of the four triggers in section 9.1.
