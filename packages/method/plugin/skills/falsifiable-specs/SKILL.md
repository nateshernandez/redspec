---
name: falsifiable-specs
description: "The artifact kinds a spec is built from and the bar each must clear. Use when writing or reviewing a spec artifact, choosing how to express a requirement, or judging whether a spec can catch its own mistakes."
---

# Falsifiable specs

A spec artifact earns its place only if some state of the world turns it **red**. Prose never goes red, which is how a long document stays wrong for weeks with nothing noticing. So every requirement is expressed as the cheapest artifact that fails when the software is wrong — and every artifact carries a digest, so it also fails when _it_ moves without anyone re-verifying it.

## The kinds

| Kind        | Answers                                       | Lives as                                                    | Goes red when                                                                                                                    |
| ----------- | --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Brief**   | why, and what is deliberately out             | `specs/<f>/BRIEF.md`, one page                              | never                                                                                                                            |
| **Surface** | which of the twelve states a screen can be in | `surfaces` in `spec.ts`, claimed as `SURFACE-<f>-<key>`     | a row is dropped (compile), a waiver's review date passes, a witness rule fails, a waiver reason is softened after it was signed |
| **State**   | what it looks like                            | a line in `states` + a case on the spec route               | its name is missing or restates its row; its assertion or screenshot diff fails                                                  |
| **Journey** | how it behaves visually                       | a flow in `spec.ts`; a Playwright spec against the real app | a path cannot be completed; a state is unreachable                                                                               |
| **Rule**    | how it behaves internally                     | a type, machine table, decision table, or invariant         | a case disagrees with the code; a table has a gap or an overlap                                                                  |
| **Copy**    | the words                                     | `copy.ts`, one `COPY-` per string                           | an assertion and a sketch disagree — they cannot, they read one constant                                                         |

A **flow** is not a kind of its own. It is how States compose into a Journey. A **waiver** is a claim about the product — "this screen cannot be in that state" — and it is written out with a reason, and where possible a `witness` (the `INV-` that would go red if the claim stopped holding) or a `review` date. The waiver is the only prose left in a bundle, which is exactly why it is digested with its surface: a reason that quietly weakens is a requirement moving.

## Picking a Rule's form

Take the first rung that fits. Read [RULES.md](RULES.md) for each form and worked examples.

0. **Model** — a bounded model checker, for the two or three rules a year where being wrong is expensive and the state space is combinatorial.
1. **Type** — when the rule can be made impossible to break. The compiler is the check.
2. **Machine table** — when the rule is a lifecycle. Pair it with a model-based run that drives the _implementation_ through random legal event sequences, not just a shape check on the table.
3. **Decision table** — when the rule is a calculation. Declare the input domains and a hit policy; `redspec check` proves the table total and non-overlapping before a row runs. Name the outcome column `state` and it becomes a **resolution table**: it routes to screens rather than to values, which is how a feature declares dimensions of its own where the twelve rows flatten a real combination. Every outcome must be a declared state, and each still owes the checklist a row.
4. **Invariant** — when the rule holds across all inputs rather than at listed points.

Rungs 2 and 3 are the two a non-engineer can review, so reach for them wherever the rule is one the business owns.

## IDs

`STATE-`, `JOURNEY-`, `RULE-`, `INV-`, `COPY-`, `SURFACE-`, lowercase and hyphenated after the prefix. A rule's ID is its filename; a surface's is `SURFACE-<feature>-<key>`. IDs are what slices claim, what `redspec check` counts, and what the lock stamps.

## Naming a State

Every declared state has one line in `states`, written the moment the state is declared and not a step later:

```ts
states: {
  "STATE-access-door-empty": "An empty address field and a Continue button",
},
```

The bar is that the name says **what the person is looking at**. An ID is an address; a row label is which slot the state fills. Neither describes a screen, and the board is read for the whole stretch between `/draft-skeleton` and `/render-states`, when nothing renders and the name is all there is.

| Not a name                | Why                                          | A name                                              |
| ------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `STATE-access-door-empty` | an address                                   | An empty address field and a Continue button        |
| "Empty"                   | the row, already drawn beside it             | Nothing typed yet, and the Google button underneath |
| "Door empty state"        | the code's word for it                       | A door with nothing filled in                       |
| "Handles the empty case"  | what the code does, not what the person sees | No teammates yet, and one Invite button             |

`redspec check` reports a missing name — and one that only restates the row or the ID — as **unnamed-state**. The name is in the state's digest, so softening one after it is signed comes back as `amended`, exactly like a waiver reason.

It is the **Then, written early**: `/render-states` writes the assertion that has to agree with it. Where the assertion and the name disagree, one of them is wrong and the disagreement is the finding.

## A State's three lives

1. **Declared.** A checklist row and a flow step name its ID, and `states` says what it is; nothing renders it. The board draws a named stub; `redspec status` lists it under _declared_. Legal, expected, red.
2. **Sketched.** `/render-states` gives it markup, a fixture, and the assertions that say what it must show.
3. **Promoted.** A slice replaces the sketch's markup with production components on the same route, and **the assertions stay unchanged**.

An assertion that must be rewritten during promotion was describing the sketch rather than the requirement. That is a finding: raise it to speak in user intent.

## Amendments

Every claimed artifact is stamped with a digest of its content when the slice that claimed it was verified. Change the content and `redspec check` reports it **amended** until either an amendment slice re-verifies it or `redspec accept` re-stamps it after a passing run. A requirement that moves without anyone signing for it is the failure mode this whole method exists to prevent.
