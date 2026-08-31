---
name: render-states
description: "Render every state the skeleton declared, assert it, and get the board signed off."
disable-model-invocation: true
---

# Render states

Turn each stub into a case that renders, and assert what a reviewer would say out loud about it. The board goes from red to green as they land, and the green board is what product signs.

Read `docs/agents/redspec.md` for the paths. Call the Skill tool with "falsifiable-specs" for what promotion means.

Steps 1, 2 and 5 are **HITL**.

## Process

### 1. Read the skeleton back

`redspec status`. The _declared_ list is your work list. Read it to the user **by name** — the `states` line, not the ID — before building: they are checking that the skeleton still describes the feature they meant, and a list of IDs is not something anyone can check.

### 2. Say where the design comes from

Either the repo already answers it — a presentational layer, an app shell, a token set; name what you reuse — or the surface has no precedent here, in which case generate structurally different variants (the `prototype` skill, if available) and come back with the winner. Never decide this silently.

### 3. Render each declared state

```
redspec new state STATE-<slug>-<case>
```

This scaffolds the fixture, the sketch, the assertion, and prints the `cases` entry to add. Fixtures are plain data — a case that reaches for the network is a Journey wearing a State's clothes. Build for the configured viewport (1280×720 by default).

**Every user-facing string goes through `copy.ts`.** The sketch renders `copy["COPY-…"]`; the assertion asserts against the same constant. A hardcoded string in a sketch is a finding.

### 4. Assert each state

One behavioural assertion per case, named for its ID, in **user intent**: that the empty state offers the action that fills it, that the error names a way forward, that the read-only case shows no control that lies about being usable. No selector, class, or coordinate — those describe the sketch and break on promotion. Plus one `toHaveScreenshot`.

**The assertion has to agree with the name the skeleton already gave the state.** The `states` line said what the person is looking at; the assertion is that same claim, made checkable. Write the title after the ID as the sentence a reviewer would say out loud, and hold it against the name:

- They agree → the assertion is right, and the board shows both.
- The name promises something the assertion does not check → the assertion is too weak. Strengthen it.
- The assertion checks something the name never mentioned → the name was vague, or the state has quietly become two states. Fix whichever it is; do not let them drift.

Nothing renames a state silently: the name is in the state's digest, so changing one after it is signed comes back as `amended`.

Journey specs in `e2e/journey/<slug>.spec.ts` are generated from the flows by `redspec new journeys <slug>`, one per reachable path, and stay `test.fixme` until the slice that claims the flow lands. Do not hand-write them.

### 5. Review the board, then hunt what it missed

`redspec board`. Walk the flows view lane by lane and the surfaces view waiver by waiver. Now that the cases render, zoom past the card tier so each node frames the live route, and check the frame against the name beside it — a state whose picture and whose name disagree is the finding this step exists to catch. Click a state to read its assertion next to it. A copy fix lands in `copy.ts` and nowhere else.

Then dispatch the `spec-adversary` agent. Work every finding: build the state, place it on a flow, or record in the Brief why it does not apply.

## Done when

`redspec status` shows no _declared_ and no _unnamed-state_ findings for this feature and `pnpm test:state` passes. Every state's assertion says what its name promised. Every case is fixture-driven. No assertion names a selector. Every string is a `COPY-`. Where the design came from was stated, and the user answered.

Then clear the window and run `/implement-rules`.
