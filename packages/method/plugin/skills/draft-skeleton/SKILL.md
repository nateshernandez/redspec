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

| What it is                                             | Where it goes                                    |
| ------------------------------------------------------ | ------------------------------------------------ |
| Why this exists, who for, what is out, what is unknown | `BRIEF.md`                                       |
| A screen, or a state a screen can be in                | a declared state in `spec.ts`, named in `states` |
| A figure, a lifecycle, a constraint                    | a rule stub in `rules/`                          |
| A user-facing string                                   | a `COPY-` entry in `copy.ts`                     |
| A term the team argued about                           | `CONTEXT.md`                                     |
| A choice made against an alternative                   | `docs/adr/`                                      |

Present the sorted list and hold until the user has read it. Nothing lands in "notes".

### 3. Scaffold and write the Brief

```
redspec new feature <slug>
```

Then fill `specs/<slug>/BRIEF.md`: Problem · Actors (one bolded bullet each — the audit reads this list) · What changes · Non-goals · Deliberate unknowns. One page, and **finished**. Anything that will not fit is a State or a Rule wearing prose.

### 4. Declare the states and the flows

Write `surfaces` and `flows` into `specs/<slug>/spec.ts`, with `cases` left empty.

**Surfaces** are the distinct screens. Walk the twelve rows for each — and **ask each row as a situation, never as a category**. "Is there a `partial` state?" is a question about a taxonomy, and people answer those badly. "Some of the roster arrived and the rest is still coming — what do they see?" is a question about a case in front of them, and people answer those well. The wording to use is each row's own gloss:

| Row               | Ask                                               |
| ----------------- | ------------------------------------------------- |
| Empty             | no data yet, first run                            |
| Loading           | initial load, and refresh while populated         |
| Partial           | some data present, some still arriving or failed  |
| Populated         | the typical case                                  |
| Overflowing       | long strings, many rows, values that break layout |
| Recoverable error | the user can retry or fix input                   |
| Terminal error    | the user cannot proceed                           |
| Permission-denied | the actor may look but not act                    |
| Stale or offline  | the data on screen is known to be out of date     |
| In-flight         | mid-submit, optimistic, awaiting confirmation     |
| Terminal success  | the flow is finished and the surface says so      |
| Conflict          | someone else changed it underneath                |

Each row names a `STATE-<slug>-<case>` or is **waived** with the reason this screen cannot be in that state.

**Every state you name, you also describe.** The answer the person just gave you _is_ the description — write it into `states` before you move to the next row, while their words are still in front of you:

```ts
states: {
  "STATE-access-door-empty": "An empty address field and a Continue button",
  "STATE-access-door-rejected": "The address still there, and a line saying what is wrong with it",
},
```

The bar is what the person is **looking at**, not which of the twelve this is. "Empty" is the row and the board already draws it; "Handles the empty case" is what the code does. `redspec check` reports both as **unnamed-state**, along with a state that has no line at all.

This is the single thing that makes the board readable before anything renders — which is the whole of step 6 and the whole of `/cut-slices` after it. A state whose only name is `STATE-access-door-empty` is a state the person you are interviewing cannot review, and you are about to ask them to. Give a waiver a `witness` (the `INV-` that would go red if the reason stopped holding) where one exists, or a `review` date where it does not. Where you are unsure, declare the state.

A waiver is an artifact: `SURFACE-<slug>-<key>` covers a screen's twelve answers, reasons included, so a slice claims it and the lock stamps it. Softening one later comes back as `amended`.

**Flows** order those states into the paths they are reached by — one per actor in the Brief, each a `JOURNEY-<slug>-<intent>`. The **spine** is the happy path; **deviations** hang off the step they branch from and either `rejoins` or `end` with what the person is left with. A state you cannot place on any path is missing the step that leads to it, or should not exist.

### 5. Stub the rules

```
redspec new rule RULE-<name> --form stub
```

One per figure, lifecycle, or constraint, with the values in a markdown table **in the words the person gave**. The domain expert is in the room exactly once. Stop at the values: the rung is `/implement-rules`' call.

Where **which screen** someone lands on turns on a combination the twelve rows flatten — a link that is fresh or expired against an account that is missing or locked — that is a **resolution table**: a decision table whose outcome column is `state`. It is the one place a feature declares its own dimensions, and `redspec check` walks the cross product and names any combination no row covers.

```md
**Inputs:** linkAge: {fresh, expired}, account: {none, locked}
**Hit policy:** UNIQUE

| linkAge | account | state                       |
| ------- | ------- | --------------------------- |
| fresh   | -       | STATE-<slug>-invite-open    |
| expired | none    | STATE-<slug>-invite-expired |
| expired | locked  | STATE-<slug>-invite-blocked |
```

Every outcome must be a state the spec declares, and each one still owes the checklist an answer.

### 6. Confirm the skeleton on the board

`redspec board`, then walk `/spec/<slug>` with the user. Every state is a stub, and every stub says what it is.

Read the board at the zoom that answers the question you are asking:

- **Zoomed out**, each state is a coloured pill and you are reading the feature's _shape_: how many branches hang off the happy path, where the red of an error family clusters, whether a lane ends where the Brief says it ends.
- **Mid zoom**, each state is a named card. This is where you walk a lane out loud: the name, the arrow's label, the next name. If that does not read as a sentence, the flow is wrong or a state is misnamed.
- **Hover a state** to light the whole path through it and dim the rest; **click** to pin it and read its detail.

The flows view answers whether the states add up to a feature and whether anything sits in the red **Not on any path** lane; the surfaces view answers the twelve rows. **Read the waivers out.**

Then dispatch the `spec-adversary` agent over `specs/<slug>/`. Work every finding.

## Done when

`redspec status` shows **only** _declared_ findings for this feature — no unnamed-state, no off-path, no off-checklist, no actor without a flow, no bad ID. Every declared state says what the person is looking at. Every waiver has been read aloud. Every end says what the person is left with. Every figure is a table row. The Brief fits on one page with a non-empty Non-goals. Nothing from the interview lives only in this conversation.

Then clear the window and run `/render-states`.
