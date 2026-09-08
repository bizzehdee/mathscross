# MathsCross

An offline maths crossword. Fill an intersecting grid with digits and arithmetic
operators so that every horizontal and vertical run forms a valid equation.

No accounts, no adverts, no network. The puzzles are generated on the device.

Ships as a web app, installable as a PWA, and as an Android app wrapped with
Apache Cordova. Both targets build from this one codebase.

## The rules

**Arithmetic is normal arithmetic.** BODMAS applies: division and multiplication
bind before addition and subtraction, and within a tier evaluation runs left to
right.

```
5 + 3 * 2 = 11        the multiplication binds first
10 - 3 + 2 = 9        same tier, so left to right
8 / 4 / 2 = 1         same tier, so left to right
```

Division must be exact, and exactness is checked per division in precedence
order, so `6 / 4 * 2` is invalid even though `6 * 2 / 4` would be 3.

A game about arithmetic does not get to invent arithmetic. Anything else would
either mark a correct answer wrong, or teach a habit that has to be unlearned.

**Numbers span cells.** Adjacent digit cells form one number, so `1` next to `5`
reads as fifteen, not as two operands. This is the one thing about the game worth
explaining, and the board draws grouped cells to show it.

## The three difficulties

| | Board | Numbers | Operators | Solvable by logic alone |
|---|---|---|---|---|
| Easy | 5x5 | single digits | `+` `-` | guaranteed |
| Medium | 7x7 | up to two digits | `+` `-` `*` | guaranteed |
| Hard | 11x11 | up to three digits | `+` `-` `*`, some hidden | not guaranteed |

Each grade adds one thing rather than several at once. Easy and Medium are checked
during generation for a chain of forced steps from the givens to the answer, so
neither ever needs a guess. Hard still has exactly one answer; finding it may take
an experiment.

Every board's shape is fixed and hand-drawn — one layout per difficulty, in
`src/engine/layouts.ts`. What differs between two puzzles at the same grade is the
arithmetic, which cells are given, and at Medium the widths of the numbers.

## Themes

Nine: system, light, dark, high contrast, and five named palettes — football, space,
sweets, jungle and ocean. Settings shows a miniature board in each, so a choice is
made by looking rather than by reading. Every palette is checked for 4.5:1 contrast
on the colours a player has to read.

## Development

Requires Node 20.

```bash
npm ci
```

Run the dev server:

```bash
npm run dev
```

Type check:

```bash
npm run typecheck
```

## Tests

The fast suite runs on every pull request:

```bash
npm test
```

The slow suite covers 100 generated puzzles per difficulty and takes minutes. It
runs nightly and on tags, not on pull requests:

```bash
npm run test:slow
```

## Builds

The web bundle, into `dist/`:

```bash
npm run build
```

The native bundle, into `native/www/` for the Cordova shell to serve:

```bash
npm run build:native
```

Both come from the same source through one config factory in `vite.config.ts`, so
a setting cannot drift between them and produce a defect reproducible on only one
platform.

## Screens

The app opens on a **home** screen rather than a board: continue what you were
doing, start something new, or take the daily. **Statistics**, **Settings** and
**How to play** are screens of their own, reached from home and left with the
Menu button. On Android the hardware back button does the same, and exits only
from home.

## Scripts

| Command | What it does |
|---|---|
| `npm run icons` | Regenerates `public/icons/` and `public/icon.svg` |
| `npm run store:assets` | Regenerates the Play feature graphic and store icon |
| `npm run size` | Fails if a gzipped output exceeds its ceiling |

Both graphics scripts use a dependency-free PNG encoder in `scripts/png.mjs`, so
no image tooling is needed.

## Design authority

[plan.md](plan.md) is the design document: the rules of the game, the generator
design, the difficulty parameters, the decisions taken and why, and the
milestones. Read it before changing behaviour.

`.learnings/` holds non-obvious facts discovered while building. Read the entries
relevant to your area before working in it.
