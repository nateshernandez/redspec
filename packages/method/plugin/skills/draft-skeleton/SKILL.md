---
name: draft-skeleton
description: "Grill a feature until it is sharp, then write its Brief and the red skeleton of every state, flow, and rule it needs."
disable-model-invocation: true
---

# Draft skeleton

Interview the idea until it is sharp, then write down **everything it produced** — as artifacts, not as notes. The Brief is finished when you leave. Everything else is a **skeleton**: names and IDs with nothing behind them, which is what makes `redspec check` go red the moment you stop typing.

That red is the deliverable. A decision that survives only in this conversation did not survive.

Read `docs/agents/redspec.md` for this repo's paths and commands. Call the Skill tool with "falsifiable-specs" for the artifact kinds.

Every step here is **HITL**: it finishes when the person who speaks for the product says so. Dispatch a subagent for any _fact_ you could look up; the _decisions_ are theirs.

## Process

### 1. Interview

If the `grilling` skill is available, call it. Otherwise interview hard: push on every "probably", record every "unknown" as one, and do not let a question get quietly dropped. Where a term gets argued about, record it in `CONTEXT.md`; where a choice is made against a real alternative, record an ADR in `docs/adr/`.

Do not write anything else until the user confirms the frontier is empty.

### 2. Sort what came out

Every fact has exactly one home:

| What it is                                             | Where it goes                 |
| ------------------------------------------------------ | ----------------------------- |
| Why this exists, who for, what is out, what is unknown | `BRIEF.md`                    |
| A screen, or a state a screen can be in                | a declared state in `spec.ts` |
| A figure, a lifecycle, a constraint                    | a rule stub in `rules/`       |
| A user-facing string                                   | a `COPY-` entry in `copy.ts`  |
| A term the team argued about                           | `CONTEXT.md`                  |
| A choice made against an alternative                   | `docs/adr/`                   |

Present the sorted list and hold until the user has read it. Nothing lands in "notes".

### 3. Scaffold and write the Brief

```
redspec new feature <slug>
```

Then fill `specs/<slug>/BRIEF.md`: Problem · Actors (one bolded bullet each — the audit reads this list) · What changes · Non-goals · Deliberate unknowns. One page, and **finished**. Anything that will not fit is a State or a Rule wearing prose.

### 4. Declare the states and the flows

Write `surfaces` and `flows` into `specs/<slug>/spec.ts`, with `cases` left empty.

**Surfaces** are the distinct screens. Walk the twelve rows for each: empty, loading, partial, populated, overflowing, recoverable error, terminal error, permission-denied, stale, in-flight, terminal success, conflict. Each row names a `STATE-<slug>-<case>` or is **waived** with the reason this screen cannot be in that state. Give a waiver a `witness` (the `INV-` that would go red if the reason stopped holding) where one exists, or a `review` date where it does not. Where you are unsure, declare the state.

**Flows** order those states into the paths they are reached by — one per actor in the Brief, each a `JOURNEY-<slug>-<intent>`. The **spine** is the happy path; **deviations** hang off the step they branch from and either `rejoins` or `end` with what the person is left with. A state you cannot place on any path is missing the step that leads to it, or should not exist.

### 5. Stub the rules

```
redspec new rule RULE-<name> --form stub
```

One per figure, lifecycle, or constraint, with the values in a markdown table **in the words the person gave**. The domain expert is in the room exactly once. Stop at the values: the rung is `/implement-rules`' call.

### 6. Confirm the skeleton on the board

`redspec board`, then walk `/spec/<slug>` with the user. Every state is a stub. The flows view answers whether the states add up to a feature and whether anything sits in the red **Not on any path** lane; the surfaces view answers the twelve rows. **Read the waivers out.**

Then dispatch the `spec-adversary` agent over `specs/<slug>/`. Work every finding.

## Done when

`redspec status` shows **only** _declared_ findings for this feature — no off-path, no off-checklist, no actor without a flow, no bad ID. Every waiver has been read aloud. Every end says what the person is left with. Every figure is a table row. The Brief fits on one page with a non-empty Non-goals. Nothing from the interview lives only in this conversation.

Then clear the window and run `/render-states`.
