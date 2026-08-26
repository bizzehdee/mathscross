# A step's own `env` is not dependable in that step's `if`

Established in MathsCross, 2026-08-26, reviewing `release.yml` before the first
release tag. Found by reading, not by a failure — the failure mode is a release
that reports success and publishes nothing.

## The observation

The Play upload step was gated on a secret being set, written the way this is
usually written:

```yaml
- name: Publish to Google Play
  if: >
    startsWith(github.ref, 'refs/tags/v')
    && steps.signing.outputs.signed == 'true'
    && env.PLAY_JSON != ''            # <- the problem
  env:
    PLAY_JSON: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
  uses: ...
```

The intent is sound. The `secrets` context is genuinely unavailable in a step
`if`, so a secret has to be tested indirectly, and lifting it into `env` is the
documented workaround for *using* a secret. The mistake is assuming the same
works for *testing* one in the `if` of the step that declares it.

## The cause

A step's `if` is evaluated to decide whether to run the step. The step's own
`env` block is part of setting the step up to run — it is applied after that
decision. So `env.PLAY_JSON` in the condition above reads whatever workflow-level
and job-level `env` provide, which here is nothing, and the condition is
permanently false.

Job-level and workflow-level `env` *are* visible to a step `if`. Only the step's
own block is not, which is why the pattern looks correct and is cited as working:
the same shape one level up does work.

## The fix

Compute the answer in an earlier step and gate on its output. A prior step's
outputs are fully resolved before the step they gate is evaluated.

```yaml
- name: Check for Play credentials
  id: play
  env:
    PLAY_JSON: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
  run: |
    if [ -n "$PLAY_JSON" ]; then
      echo "configured=true" >> "$GITHUB_OUTPUT"
    else
      echo "configured=false" >> "$GITHUB_OUTPUT"
    fi

- name: Publish to Google Play
  if: steps.play.outputs.configured == 'true'
```

Inside `run`, the step's own `env` is available — that is the part that does
work, and it is what keeps the secret off the command line and out of the log.
Print only whether it is non-empty, never the value.

## Why it is worth recording

Every other step in the release succeeds. The binaries build, they attach to the
GitHub release, and the workflow is green. The only symptom is that the store
version never changes, which is easy to attribute to Play review latency rather
than to the pipeline.

The general rule this is a case of: prefer a prior step's output to any context
value that resolves at the same moment as the thing it is meant to gate. When a
condition guards an irreversible action, the cost of it silently reading false
is a whole release cycle.
