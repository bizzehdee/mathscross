---
name: research-provenance
description: Information check order before any web search or download, and rules for archiving, indexing, and extracting sources so research is reproducible and reusable. USE FOR looking up a fact, spec, API, or library behaviour. USE FOR deciding whether to search the web. USE FOR downloading or saving an external document. USE FOR citing or reusing a previously found source. DO NOT USE FOR verifying a package's identity or licence before adding it - see dependency-management.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Research provenance

## Check order

Before any web search or download, check in this order and stop at the first hit:

1. **The ticket or task.** The answer, or a link to it, may already be stated.
2. **The `.learnings/` directory.** A past task may have already distilled the
   answer ([[learnings]]).
3. **The `research/` directory.** Someone may have already found and archived this.
4. **The web.** Only once 1 to 3 have been checked and none has it.

Reaching for a web search or download first is a process error, not a shortcut.
State which of the first three you checked and what you found (or didn't) before
searching the web.

## Archiving a source

When a web search or download turns up something worth keeping:

- Save the source into `research/`, with a filename that carries an explicit
  version or date so a later, different version of the same page cannot silently
  overwrite it (e.g. `research/sources/postgres-mvcc-16.2.pdf`,
  `research/sources/stripe-webhooks-2026-08-19.html`).
- Never rely on the origin URL remaining available or unchanged. Archive the
  content itself, not just a link to it.

## The index

Maintain `research/index.md` (or equivalent) as the record of what has been
gathered:

- What the source is.
- Its version, edition, or retrieval date.
- Where it lives (the archived path) and where it came from (the origin URL).

Update the index in the same change that adds or removes an archived source. An
unindexed file in `research/` is undiscoverable and might as well not exist.

## The extract

Write the extract against the task that needed it, not against the source
document. Pull out the specific facts, figures, or passages that answer the
question, in the task's own terms, so the next agent can act on the extract
without reopening the PDF, replaying the search, or re-reading the page. A
citation without an extract shifts the reading work onto whoever reads it next.

## Primary sources

Prefer a primary source already in the tree — the project's own code,
configuration, schema, or vendored documentation — over an external search. The
repository is more likely to be correct for its own behaviour than a general web
result, and it needs no archiving step because it is already versioned
([[dependency-management]], [[existing-project-conventions]]).

## Checklist

- [ ] Ticket, `.learnings/`, and `research/` checked before any web search.
- [ ] Source archived under `research/` with a version- or date-qualified name.
- [ ] Index updated with what, version, and where.
- [ ] Extract written against the task, not left as a bare citation.
