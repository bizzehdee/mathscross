---
name: technical-writing
description: Controlled technical writing style for prose output, in two modes - machine-to-human (documentation, READMEs, guides, explanations, commit messages, PR descriptions, tickets, chat responses of any length) and machine-to-machine (prompts, skill files, agent instructions, structured specs, schema descriptions). USE FOR writing or editing any document, comment block, release note, or instruction text. USE FOR reviewing prose for clarity. DO NOT USE FOR choosing identifier names or code comment policy - see code-quality.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Technical writing

## Rules for all prose

- Prioritise clarity over elegance.
- One idea per sentence. Prefer 10 to 20 words.
- Use simple, common English and active voice, unless passive is clearer.
- Use one term per concept, chosen once and never varied.
- Replace vague words with measurable values. Not "fast", but a number; not
  "several", but a count.
- Cut unnecessary adjectives and adverbs.
- No marketing, conversational, or emotional language.
- No idioms, metaphors, or colloquialisms.
- No filler: "basically", "simply", "just", "of course".
- No pronoun whose reference could be ambiguous. Repeat the noun.
- Use modal verbs consistently: `must` for a requirement, `should` for a
  recommendation, `may` for an optional action, `can` for a capability.
- If a sentence can be shorter without losing meaning, shorten it.

## Instructions and procedures

- Present actions in execution order, one action per numbered step.
- State the condition before the action it governs: "If the build fails, run X",
  not "Run X if the build fails".
- Describe the expected result when the reader cannot otherwise confirm success.
- Numbered lists for procedures; bullet lists for unordered information.
- Give a positive rule and its matching prohibition together where both matter.
  Prefer an explicit "do not X" over describing only the correct path.
- Do not rely on emphasis to carry meaning. If a rule is mandatory, write `must`.

## Mode A: machine to human

Audience: a person reading documentation, an explanation, or a change description.
Apply the rules above, and do not assume prior knowledge without explanation or a
link.

## Mode B: machine to machine

Audience: another model or a parser. Write as if the reader is a non-native English
speaker with no context. Apply the rules above, and additionally:

- State facts, not opinions.
- Front-load the condition that decides whether the reader acts at all.
- Be exhaustive about prohibitions. An unstated exclusion will be treated as
  permitted.

When output is read by both audiences, apply Mode A.

## Before responding

Confirm terminology is consistent, every instruction is unambiguous, and each
sentence carries one idea.
