---
name: falsifiable-specs
description: "The artifact kinds a spec is built from and the bar each must clear. Use when writing or reviewing a spec artifact, choosing how to express a requirement, or judging whether a spec can catch its own mistakes."
---

# Falsifiable specs

A spec artifact earns its place only if some state of the world turns it **red**. Prose never goes red, which is how a long document stays wrong for weeks with nothing noticing. So every requirement is expressed as the cheapest artifact that fails when the software is wrong — and every artifact carries a digest, so it also fails when _it_ moves without anyone re-verifying it.

## The kinds

| Kind        | Answers                                       | Lives as                                                    | Goes red when                                                                   |
| ----------- | --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Brief**   | why, and what is deliberately out             | `specs/<f>/BRIEF.md`, one page                              | never                                                                           |
| **Surface** | which of the twelve states a screen can be in | `surfaces` in `spec.ts`                                     | a row is dropped (compile), a waiver's review date passes, a witness rule fails |
| **State**   | what it looks like                            | a case on the spec route                                    | its assertion or screenshot diff fails                                          |
| **Journey** | how it behaves visually                       | a flow in `spec.ts`; a Playwright spec against the real app | a path cannot be completed; a state is unreachable                              |
| **Rule**    | how it behaves internally                     | a type, machine table, decision table, or invariant         | a case disagrees with the code; a table has a gap or an overlap                 |
| **Copy**    | the words                                     | `copy.ts`, one `COPY-` per string                           | an assertion and a sketch disagree — they cannot, they read one constant        |

A **flow** is not a kind of its own. It is how States compose into a Journey. A **waiver** is a claim about the product — "this screen cannot be in that state" — and it is written out with a reason, and where possible a `witness` (the `INV-` that would go red if the claim stopped holding) or a `review` date.

## Picking a Rule's form

Take the first rung that fits. Read [RULES.md](RULES.md) for each form and worked examples.

0. **Model** — a bounded model checker, for the two or three rules a year where being wrong is expensive and the state space is combinatorial.
1. **Type** — when the rule can be made impossible to break. The compiler is the check.
2. **Machine table** — when the rule is a lifecycle. Pair it with a model-based run that drives the _implementation_ through random legal event sequences, not just a shape check on the table.
3. **Decision table** — when the rule is a calculation. Declare the input domains and a hit policy; `redspec check` proves the table total and non-overlapping before a row runs.
4. **Invariant** — when the rule holds across all inputs rather than at listed points.

Rungs 2 and 3 are the two a non-engineer can review, so reach for them wherever the rule is one the business owns.

## IDs

`STATE-`, `JOURNEY-`, `RULE-`, `INV-`, `COPY-`, lowercase and hyphenated after the prefix. A rule's ID is its filename. IDs are what slices claim, what `redspec check` counts, and what the lock stamps.

## A State's three lives

1. **Declared.** A checklist row and a flow step name its ID; nothing renders it. The board draws a stub; `redspec status` lists it under _declared_. Legal, expected, red.
2. **Sketched.** `/render-states` gives it markup, a fixture, and the assertions that say what it must show.
3. **Promoted.** A slice replaces the sketch's markup with production components on the same route, and **the assertions stay unchanged**.

An assertion that must be rewritten during promotion was describing the sketch rather than the requirement. That is a finding: raise it to speak in user intent.

## Amendments

Every claimed artifact is stamped with a digest of its content when the slice that claimed it was verified. Change the content and `redspec check` reports it **amended** until either an amendment slice re-verifies it or `redspec accept` re-stamps it after a passing run. A requirement that moves without anyone signing for it is the failure mode this whole method exists to prevent.
