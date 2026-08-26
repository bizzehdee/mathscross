---
name: dependency-management
description: Rules for adding, pinning, updating, and removing third-party dependencies, including licence checks, supply-chain verification, and lockfile discipline. USE FOR adding a package or library, choosing between two libraries, updating or removing a dependency, reviewing a lockfile or manifest change, centralising versions, or responding to a security advisory. DO NOT USE FOR structuring internal modules - see architecture-principles.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Dependency management

A dependency is a security decision and a maintenance commitment, not a
convenience.

## Before adding one

Obtain user approval first ([[existing-project-conventions]]). State the problem it
solves, why the standard library or an existing dependency cannot, and how much of
its surface you will use.

Then check and report:

- **Licence** — compatible with this project's licence and distribution. Flag
  copyleft, dual-licensed, or non-standard.
- **Maintenance** — date of last release, whether more than one maintainer is
  active, open critical issues.
- **Vulnerabilities** — advisories against the version you intend to use.
- **Transitive weight** — how many further packages it brings. A convenience that
  pulls forty packages is not small.
- **Identity** — the exact name from the official registry. Typosquatted names
  differ by one character ([[secure-engineering]]).

Reject what you cannot verify. Never guess a package's provenance.

Prefer, in order: the standard library; a dependency the project already has;
twenty lines of your own. Never add a dependency to avoid understanding something.
Check the ticket and `research/` before searching the web for candidates or
verification ([[research-provenance]]).

## Pinning

- The lockfile must be committed. It is the record of what shipped.
- Never hand-edit a lockfile. Regenerate it with the package manager.
- Review lockfile changes. An unexplained transitive bump is a supply-chain event,
  not noise.
- Match the repository's version-range convention. Do not move between exact pins
  and floating ranges without approval.
- Where the ecosystem supports central version management, use it so each version
  is declared once.

## Updating and removing

- Update deliberately. An unrelated bump does not belong in a feature change
  ([[git-and-commits]]).
- Read the changelog for a major bump and state the breaking changes.
- Security updates take priority and may ship alone.
- Run the tests after any update and report the actual result
  ([[testing-standards]]).
- Remove a dependency from the manifest in the same change that stops using it. An
  unused dependency is dead weight and attack surface ([[code-quality]]).
- Prefer removing a dependency over wrapping it.

## Prohibited

- Installing from an unofficial source, a bare URL, or a personal fork without
  explicit approval.
- Running install scripts from an unverified package.
- Vendoring without recording origin, version, and reason.
- Adding a dependency solely to satisfy a preference the project does not share.

## Checklist

- [ ] The user approved the addition.
- [ ] Licence, maintenance, and advisories checked and reported.
- [ ] Name verified against the official registry.
- [ ] Lockfile committed, and generated rather than edited.
- [ ] Tests run, result reported.
- [ ] Unused dependencies removed from the manifest.
