---
name: spec-flow
description: "The map: which redspec step to reach for, and where you are in idea to merged."
disable-model-invocation: true
---

# Spec flow

Specs made of artifacts that can go **red**, instead of documents that cannot. You do not remember six skills, so ask here.

## The flow

| Step | Skill              | Owner           | Produces                                                              |
| ---- | ------------------ | --------------- | --------------------------------------------------------------------- |
| 1    | `/draft-skeleton`  | product         | `BRIEF.md`, plus every state, flow, and rule **declared and red**     |
| 2    | `/render-states`   | product         | each declared state rendered, asserted, signed off on the board       |
| 3    | `/implement-rules` | engineering     | each stubbed rule on a rung that can fail, and failing when it should |
| 4    | `/cut-slices`      | engineering     | vertical slices, each claiming the artifacts it makes green           |
| 5    | `/build-slice`     | engineering     | one slice green, its claims **stamped**, PR open. Repeat per slice    |
| ∞    | `/amend`           | whoever owns it | a changed artifact re-signed, re-verified, re-stamped                 |

**Clear the window between steps.** Each one starts from `redspec status`, not from the conversation. A step that cannot start cold is telling you the spec failed to say something — which is a finding, not a reason to keep the window.

## The two commands

- `redspec status` — the work list, in English. Read it at the start of every step.
- `redspec check` — the gate. Exit 0 or the work is not done.

Everything else is `redspec new` (scaffold an artifact, never hand-write into `specs/`) and `redspec accept` (re-stamp after a passing run).

## The skeleton is the point

`/draft-skeleton` ends with the repo **red**: states declared that nothing renders, rules stubbed that nothing implements, every ID an orphan. That red list is the interview, written down where it fails loudly. Everything after it is turning the list green — and `/amend` is what happens when a green thing moves.

## Every step is HITL

Each step stops and waits for the person who owns it. Product signs the Brief and the board, in a browser. Engineering signs the rungs and the slicing. The AFK work is the grind inside a step, and it goes to subagents: `spec-adversary` hunting what a bundle failed to say, `slice-verifier` checking a diff against its claims.

## When to skip it

A one-file fix needs no spec. The flow earns its ceremony on work that touches several layers and more than one session.
