# GitHub Pages deploys from a tag need an environment rule

Established in the Sudoku project, 2026-08-26, on its first release attempt.
Copied here because MathsCross uses the same tag-triggered Pages deploy, so it
will hit this on its own first tag.

## The observation

A tag-triggered workflow using `actions/deploy-pages` fails with:

```
Tag "v0.1.0" is not allowed to deploy to github-pages due to environment
protection rules. The deployment was rejected or didn't satisfy other protection
rules.
```

The build job succeeds first. Only the deploy job is rejected.

## The cause

`actions/deploy-pages` requires the `github-pages` environment, and GitHub creates
that environment with a **deployment branch rule limited to the default branch**.
A tag is not a branch, so any tag-triggered deploy is refused.

This is a protection rule, checked before the deploy job starts. It is not a
permissions problem, and no change to the workflow can work around it. Adding
permissions, changing `id-token`, or setting the environment `url` makes no
difference.

## The fix

Settings, Environments, `github-pages`, then under **Deployment branches and
tags** add a rule with ref type **Tag** and pattern `v*`. Keep the default-branch
rule too, so a `workflow_dispatch` from the default branch still works.

A run rejected this way recovers with **Re-run failed jobs**. The tag does not
need deleting and re-pushing, because the build artifact is unaffected.

## Why it is worth recording

The failure names the tag, which invites the conclusion that the tag or the
trigger is wrong. It is neither: the workflow is correct and a repository setting
is the blocker. The error text does not point at the setting that fixes it.

Do this before pushing the first `v*` tag, not after.
