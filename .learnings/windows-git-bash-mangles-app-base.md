# Git Bash rewrites APP_BASE into a Windows path

Established 2026-08-26, at M0, while verifying the Pages base path.

## The fact

MSYS, which Git Bash is built on, converts arguments and environment values that
look like POSIX absolute paths into Windows paths before the child process sees
them. `APP_BASE=/mathscross/` therefore does not reach Vite as `/mathscross/`.

Run in Git Bash on Windows:

```bash
APP_BASE=/mathscross/ npm run build
```

The build succeeds, and produces:

```
src="/C:/Program Files/Git/mathscross/assets/index-Ccvu_3k3.js"
```

`start_url` and `scope` in the manifest are mangled the same way. Nothing fails,
which is what makes this worth writing down: the output is wrong and the exit code
is zero.

## Why it looks like a code defect and is not

The value is mangled before `vite.config.ts` runs, so `normaliseBase` receives an
already-corrupted string and normalises it faithfully. Reading the built HTML
suggests the base handling is broken. It is not.

Verified correct by setting the variable from PowerShell instead:

```powershell
$env:APP_BASE = "/mathscross/"; npm run build
```

which produces `/mathscross/assets/...` and a manifest whose `start_url` and
`scope` are both `/mathscross/`.

## Consequences

- **CI is unaffected.** `pages.yml` runs on `ubuntu-latest`, where no path
  conversion exists, and takes the value from `actions/configure-pages` rather than
  from a shell literal.
- **Local verification must not use Git Bash** for this variable. Use PowerShell, or
  prefix the command with `MSYS_NO_PATHCONV=1`.
- The same trap applies to any future environment value or CLI argument that begins
  with a slash: a base path, a URL path, a container mount point.

## Where this applies again

Any leading-slash value passed through Git Bash on Windows. This is a second
instance of the same class of problem as the sibling's
`windows-npm-script-env-vars.md`, which is why that project uses a second Vitest
config rather than an environment variable to select the slow suite. Prefer a config
file over an environment variable on this platform wherever the choice exists.
