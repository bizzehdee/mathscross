# MathsCross

An offline maths crossword. Fill an intersecting grid with digits and arithmetic
operators so that every horizontal and vertical run forms a valid equation.

No accounts, no adverts, no network. The puzzles are generated on the device.

Ships as a web app, installable as a PWA, and as an Android app wrapped with
Apache Cordova. Both targets build from this one codebase.

## The one surprising rule

Equations evaluate **strictly left to right**, top to bottom for vertical runs.
Operator precedence is ignored:

```
5 + 3 * 2 = 16        because (5 + 3) * 2 = 16, not 5 + (3 * 2) = 11
```

This is deliberate. It keeps the mental arithmetic tractable on a phone screen.

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

## Design authority

[plan.md](plan.md) is the design document: the rules of the game, the generator
design, the difficulty parameters, the decisions taken and why, and the
milestones. Read it before changing behaviour.

`.learnings/` holds non-obvious facts discovered while building. Read the entries
relevant to your area before working in it.
