# Agent instructions

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

This file holds only the rules that apply to every turn. Detailed standards are
separate files, listed below. Load one **before** starting the work it governs,
not after.

**How to load a standard**, in order of preference for your runtime:

1. If you have a skill or rule loader that already lists it, use that.
2. Otherwise, read the file at the path in the third column. Read it in full
   before acting on the work it governs.

## Non-negotiables

These apply always. Do not wait to load a standard before honouring them.

1. **Security and privacy rank above simplicity, effort, and delivery speed.**
   Never trade them for simpler code or faster delivery. Default to the secure
   option and say that you did. Surface a genuine tradeoff to the user before
   implementing it; never silently pick the weaker side.
   Detail: `secure-engineering`.
2. **An existing repository's conventions beat every default here.** Establish the
   repository's build command, test command, structure, and conventions before
   your first change. Read `.learnings/` — its index and every relevant entry —
   before your first change, and record what this task teaches back into it,
   creating the directory if it does not exist yet.
   Detail: `existing-project-conventions`, `learnings`.
3. **Tests must pass before a task is done.** Do not mark a checkbox or report
   completion until you have run the tests and observed them pass. If they fail,
   include the output. Detail: `testing-standards`.
4. **Do not guess.** Do not assume unstated requirements. Ask when requirements
   are ambiguous, and when obvious candidate answers exist, present them as
   options rather than asking open-ended.
5. **Prefer modifying existing working code over rewriting it.**
6. **Justify before you abstract, and ask before you re-architect.** State why a
   new abstraction is needed before adding it. Obtain approval before an
   architectural change. Detail: `code-quality`, `architecture-principles`.
7. **Diagnose by elimination, never by fix-first.** Do not change code to see what
   happens. Change code only to test a named candidate, and name it first.
   Detail: `elimination-debugging`.
8. **Report outcomes faithfully.** If a step was skipped, say so. If a result is
   unverified, label it unverified. Do not describe intended behaviour as
   observed behaviour.

## Standards

Load by trigger. When two or more triggers match, load all of them.

| Standard | Load when | Path |
|---|---|---|
| `architecture-principles` | designing a new feature, choosing where code belongs, deciding project or folder structure, evaluating a proposed pattern, or reviewing coupling between features | `.agents/skills/architecture-principles/SKILL.md` |
| `code-quality` | writing new code, reviewing a diff, refactoring, deciding whether to extract an abstraction, deciding whether to add a comment, or cleaning up a file | `.agents/skills/code-quality/SKILL.md` |
| `dependency-management` | adding a package or library, choosing between two libraries, updating or removing a dependency, reviewing a lockfile or manifest change, centralising versions, or responding to a security advisory | `.agents/skills/dependency-management/SKILL.md` |
| `elimination-debugging` | debugging a bug, a failing test, a crash, a performance regression, flaky behaviour, an incorrect output, a build failure, or any question of the form "why does X happen"; root-cause analysis and incident investigation; backing a non-trivial design or technical decision with gathered evidence rather than a plausible theory | `.agents/skills/elimination-debugging/SKILL.md` |
| `error-handling` | designing a function's failure signature, deciding whether to return an error or throw, writing a catch block, handling a failed external call, mapping errors at a boundary, or reviewing error paths | `.agents/skills/error-handling/SKILL.md` |
| `existing-project-conventions` | any change to a repository you did not create, before choosing a library, before adding a project or folder, before applying a personal or default convention, and when a default guideline conflicts with what the repository already does | `.agents/skills/existing-project-conventions/SKILL.md` |
| `git-and-commits` | writing a commit message, deciding what belongs in one commit, staging changes, naming a branch, writing a pull request description, or deciding whether to amend, rebase, or force-push | `.agents/skills/git-and-commits/SKILL.md` |
| `learnings` | recording a non-obvious fact, gotcha, root cause, constraint, decision rationale, or research conclusion discovered while working; starting a new feature, changing an existing feature, or making any first change in a repository; correcting or retiring a learning that observation has contradicted | `.agents/skills/learnings/SKILL.md` |
| `no-hardcodes` | every commit, before it is made; reviewing a diff for values that should be configuration, deciding whether a literal belongs in source, or responding to a blocked commit | `.agents/skills/no-hardcodes/SKILL.md` |
| `observability-standards` | adding or reviewing logging, choosing log levels, instrumenting a feature, adding metrics or traces, adding a health check, or when tempted to add print statements or temporary debug output | `.agents/skills/observability-standards/SKILL.md` |
| `performance-discipline` | responding to a slowness report, reviewing code for efficiency, writing a database query or a loop over a large collection, handling file or streamed payloads, or when asked to make something faster | `.agents/skills/performance-discipline/SKILL.md` |
| `research-provenance` | looking up a fact, spec, API, or library behaviour; deciding whether to search the web; downloading or saving an external document; citing or reusing a previously found source | `.agents/skills/research-provenance/SKILL.md` |
| `secure-engineering` | any task that touches authentication, authorisation, secrets, credentials, tokens, cryptography, key handling, encoding, serialisation, user input handling, external API calls, personal data, file uploads, or configuration of environments; any design decision where a convenient option and a safer option both exist | `.agents/skills/secure-engineering/SKILL.md` |
| `technical-writing` | writing or editing any document, comment block, release note, or instruction text; reviewing prose for clarity | `.agents/skills/technical-writing/SKILL.md` |
| `testing-standards` | writing, reviewing, or planning tests; deciding whether a task is complete; judging whether existing test coverage is adequate; deciding what to test after fixing a bug | `.agents/skills/testing-standards/SKILL.md` |

## Precedence

Highest authority first:

1. An explicit instruction from the user in the current conversation.
2. This repository's own documented conventions and tooling configuration.
3. The patterns used in the surrounding code.
4. The standards listed above.

The single exception is security. Rule 1 of the non-negotiables outranks a
repository convention that is insecure. Raise it rather than following it.
