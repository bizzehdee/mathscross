---
name: elimination-debugging
description: Structured elimination method for diagnosing a defect, failure, or unexplained behaviour, with a required candidate-enumeration and elimination-table report format, and the evidence-before-decisions rule. USE FOR debugging a bug, a failing test, a crash, a performance regression, flaky behaviour, an incorrect output, a build failure, or any question of the form "why does X happen". USE FOR root-cause analysis and incident investigation. USE FOR backing a non-trivial design or technical decision with gathered evidence rather than a plausible theory. DO NOT USE FOR implementing a new feature, writing tests for working code, or answering a question that needs no diagnosis.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Elimination debugging

Diagnose by elimination. Never test one hypothesis at a time until one happens to
fit.

## Procedure

1. **Enumerate first.** Before running any test, list every cause the current
   evidence allows, and write the list into your response. Do not start from the
   most likely cause. Do not rank the list.

2. **Check completeness.** Ask what cause would fall outside the list. If you
   cannot show completeness, add a candidate named `not yet enumerated` and keep it
   until you can.

3. **Do not assume a single cause.** State whether the candidates are mutually
   exclusive. If they are not, keep eliminating after the first is confirmed.

4. **Prefer tests that split the list.** Choose the test that can remove the most
   candidates. Never run a single-candidate test when a splitting test is
   available.

5. **Eliminate only with evidence.** Record the candidate, the test, the observed
   result, and why that result rules it out. Low plausibility is not evidence.
   "Unlikely" is not "eliminated". An elimination without a recorded observation is
   invalid.

6. **Track state explicitly.** One row per candidate, status `eliminated`,
   `surviving`, or `untested`, updated after every test, included in every progress
   report.

7. **Stop rule.** Stop when exactly one candidate survives *and* direct positive
   evidence supports it. If several survive, report all of them. Never choose
   between survivors by preference, elegance, or familiarity.

8. **An empty set means the enumeration was wrong.** If every candidate is
   eliminated, the list was incomplete or a test was invalid. Return to step 1.
   Do not resume guessing.

9. **No fix-first debugging.** Never change code to see what happens. Change code
   only to test a named candidate, and name it first.

## Required report format

### Candidates
The full list, with one line on why it is or is not complete.

### Elimination table

| Candidate | Test | Observed result | Verdict |
|---|---|---|---|
| ... | ... | ... | eliminated / surviving / untested |

### Surviving candidate(s)
One or more. Never zero — if zero, return to step 1 instead of reporting.

### Direct positive evidence
The observation that positively demonstrates the survivor causes the behaviour.
Absence of other causes is not positive evidence.

### Reopening assumptions
Assumptions that, if false, would reopen an eliminated candidate.

## Evidence before decisions

The same discipline applies to any non-trivial technical decision, not only to a
defect. Diagnosis comes before any change: the root cause is usually cheaper to
measure than a fix built on a guess is to unwind, and a fix aimed at an assumed
cause often masks the real one.

- Back the decision with an observation you actually gathered — the failure
  output, a targeted trace or probe, a comparison of a working path against the
  broken one — never with a plausible-sounding theory. Plausibility has pointed
  at the wrong fix before; a measurement points at the right one.
- "It's probably X" is the signal to stop and take the measurement that confirms
  or refutes X before building anything on it.
- When reporting a root cause or closing a task, cite the observation that proves
  it — the log line, the trace, the behavioural diff — not just the conclusion,
  so it is checkable. A belief not yet tested is labelled a hypothesis
  ([[technical-writing]]).

## Notes

- A test may be a code read, a log inspection, a query, an instrumented run, a
  comparison of a working path against the broken one, or a minimal
  reproduction. It need not be automated.
- A candidate you cannot test with available access is `untested`. Say what access
  is needed. Never silently drop it.
- A confirmed cause requires a regression test ([[testing-standards]]).
