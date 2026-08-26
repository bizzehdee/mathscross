---
name: architecture-principles
description: Architectural defaults for new code and new features - vertical slice architecture over layered service-heavy designs, self-contained features, minimal cross-feature dependencies, composition over inheritance, and no speculative patterns. USE FOR designing a new feature, choosing where code belongs, deciding project or folder structure, evaluating a proposed pattern, or reviewing coupling between features. DO NOT USE FOR an existing repo whose architecture is already established - see existing-project-conventions, which takes precedence.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Architecture principles

Defaults for greenfield work, and for new features where no convention exists. In an
existing codebase [[existing-project-conventions]] takes precedence.

## Vertical slices over layers

Prefer vertical slice architecture over layered, service-heavy designs. A slice owns
everything one feature needs: entry point, validation, data access, response shape.

- Organise folders by feature, not technical role: `Orders/CreateOrder/`, not
  `Services/` plus `Repositories/` plus `Controllers/`.
- Never create a layer that only forwards a call to the next layer.
- Never create a service class holding one method called from one place. Put the
  logic in the slice.

## Self-containment

- A change to one feature should not require editing another feature's files.
- Shared code must be genuine shared infrastructure. A `Common` or `Shared`
  namespace that grows every sprint means features are not self-contained.

## Cross-feature dependencies

- A feature must never call another feature's internals.
- If feature A needs behaviour from feature B, prefer in order: duplicate the small
  piece A needs; extract it into shared infrastructure both depend on; communicate
  through an event or published contract.
- Never introduce a bidirectional dependency between two features. If you find one,
  report it.

## Composition over inheritance

- Use inheritance only for a genuine substitutable specialisation, where every
  derived type satisfies the base type's contract.
- Never use inheritance to share code; inject a collaborator instead.
- Never create a base class with a single derived type.
- Prefer an interface plus an injected implementation over an abstract base class
  with protected helpers.

## No speculative patterns

Before adding a mediator, event bus, repository over an already-abstracted data
layer, plugin system, or configuration-driven indirection, state the current problem
it solves. "It makes future changes easier" is not a current problem — do not add it
([[code-quality]]).

Architectural changes require user approval before implementation.

## Checklist

- [ ] New code is organised by feature.
- [ ] No layer exists solely to forward calls.
- [ ] No feature reaches into another feature's internals.
- [ ] Every inheritance relationship is a substitutable specialisation.
- [ ] Every pattern introduced has a stated current problem.
