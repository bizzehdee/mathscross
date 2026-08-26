---
name: learnings
description: Durable project knowledge in a .learnings/ directory - when a hard-won, non-obvious fact or a distilled research conclusion must be written down as a Markdown file, the file and index format, and the duty to consult and cite existing learnings instead of re-deriving them. USE FOR recording a non-obvious fact, gotcha, root cause, constraint, decision rationale, or research conclusion discovered while working. USE FOR starting a new feature, changing an existing feature, or making any first change in a repository. USE FOR correcting or retiring a learning that observation has contradicted. DO NOT USE FOR archiving external source documents - see research-provenance.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Learnings

## What counts as a learning

A learning is a non-obvious fact about this project that cost real effort to
establish and that a future agent or developer would otherwise rediscover from
scratch:

- A root cause and the evidence that proved it ([[elimination-debugging]]).
- A constraint imposed from outside the code — a vendor limit, a protocol quirk,
  a deployment restriction — and where it comes from.
- An environment or tooling behaviour that contradicts its documentation or a
  reasonable expectation.
- The distilled conclusion of a piece of research, with the archived source it
  rests on ([[research-provenance]]).
- A decision and the reason it went the way it did, when the reason is not
  recoverable from the code or its history.

Not a learning: anything the code, configuration, or git history already states —
the repository is its own record; anything true only for the current session; and
never a secret, credential, or personal data ([[secure-engineering]]).

## Where they live

- One learning per file: `.learnings/<topic>.md`, kebab-case, named for the fact
  it holds, not for the task that found it.
- A repository without a `.learnings/` directory has simply not recorded one
  yet. Create the directory and its index with the first learning; a missing
  directory is never a reason to skip recording.
- Each file states the fact, the absolute date it was established, and the
  evidence or archived source that proves it — a log line, a trace, a
  `research/` path — so the next reader can judge whether it still holds.
- Maintain `.learnings/index.md`: one line per file saying what it covers and
  when to read it. Update it in the same change that adds or removes a learning.
  An unindexed learning is undiscoverable and might as well not exist.
- Write the learning in the same change or session that established it. A
  learning deferred to a follow-up is a learning lost.

## Consulting them

- Before starting work in an area, read `.learnings/index.md` and any entry it
  lists as relevant, before re-deriving or re-researching anything
  ([[existing-project-conventions]]).
- When acting on a learning, cite its file, so the conclusion is checkable and
  the entry's usefulness is visible.
- A learning is a record of what was true when it was written, not a guarantee.
  If current observation contradicts one, trust the observation — then update or
  delete the entry in the same change. A stale learning misleads everyone who
  reads it after you.

## Checklist

- [ ] `.learnings/index.md` read before working in an area it covers.
- [ ] Every hard-won fact from this task recorded, dated, and evidenced.
- [ ] Index updated in the same change.
- [ ] No secret, credential, or personal data in any entry.
- [ ] Any entry contradicted by observation was corrected or removed.
