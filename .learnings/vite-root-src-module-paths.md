# Vite serves modules from `root`, not the repository root

Established in the Sudoku project, 2026-08-25. Applies to MathsCross identically,
because `vite.config.ts` sets the same `root: 'src'`.

## The fact

With `root: 'src'`, the dev server serves modules relative to `src/`, not to the
repository root.

A dynamic import in the page must use `/engine/solver.ts`, not
`/src/engine/solver.ts`. The latter fails with:

```
TypeError: Failed to fetch dynamically imported module:
http://localhost:5173/src/engine/solver.ts
```

## Why it is useful

The dev server transforms and serves the real TypeScript modules, so a browser
session can import the actual engine and drive the UI with it: read the board out
of the DOM, import `/engine/solver.ts`, solve, then type the answer through real
keyboard events. That is the cheapest way to verify a board end to end without
writing a UI test for it.

This works only against the dev server. A production build has hashed bundles with
no such paths.
