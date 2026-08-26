# Select a test suite with a config file, not an environment variable

Established in the Sudoku project, 2026-08-25, during scaffolding. MathsCross
follows the same arrangement for the same reason, and this entry is why.

## The fact

An npm script cannot set an environment variable inline on Windows. The POSIX form
`VAR=1 vitest run` is a parse error under `cmd.exe`, which is what npm uses to run
scripts on Windows. The usual workaround is the `cross-env` package.

## The decision

`npm run test:slow` points at `vitest.slow.config.ts` rather than setting a
variable. Two config files, no environment variable, no dependency.

Adding `cross-env` to select a test suite does not clear the bar for a new
dependency when a second config file achieves the same thing and is also clearer
about what each suite includes. The same reasoning gives MathsCross
`vite.cordova.config.ts` rather than a `BUILD_TARGET` variable.

## Where this applies again

Any npm script needing per-run configuration. Prefer a config file, a CLI flag, or
a separate script over an inline environment variable, so the scripts stay portable
between a Windows development machine and Linux CI.

There is a second, sharper instance of this class of problem in
[windows-git-bash-mangles-app-base.md](windows-git-bash-mangles-app-base.md),
where a variable that *is* set correctly still arrives corrupted.
