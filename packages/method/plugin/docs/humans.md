# Speccing a feature: the two steps you own

For the person running `/draft-skeleton` and `/render-states`. The agent-facing conventions are in `docs/agents/redspec.md`; you do not need them.

Steps 1 and 2 are product's. Steps 3 to 5 are engineering's. Neither side reviews the other's work on their behalf, so what you sign off in these two steps is what the rest of the flow is built from. **Clear the agent's window between steps** — each one starts from the files, not the conversation, and a step that cannot start cold means the last one left something unsaid.

## Step 1 — `/draft-skeleton`

Bring an idea at whatever resolution you have it. The agent interviews you hard; answer, or say "unknown" and it gets recorded as one. Then it sorts every fact into a file and shows you the sorted list before writing anything.

You review two things. **The Brief** (`{{specsDir}}/<feature>/BRIEF.md`) — one page; its most valuable sections are Non-goals and Deliberate unknowns. **The skeleton**, on the board at `{{route}}/<feature>`: every declared state is a dashed card that says, in a sentence, what the person is looking at — "An empty address field and a Continue button". You are signing the shape, not the pixels.

If a card's name does not tell you what would be on that screen, say so. It is the cheapest finding on the board and the most expensive one to leave: it is the sentence the whole feature gets built against, and the ID underneath it (`STATE-access-door-empty`) is only an address.

### Reading the board

Zoom is the level of detail, so pick the one that matches your question.

- **Zoomed out**, each state is a coloured pill and you are reading the feature's _shape_ — how many branches hang off the happy path, where the errors cluster, whether a path ends where you expected. Colour is the kind of moment: grey at rest, blue waiting, red gone wrong, amber blocked, green finished.
- **Mid zoom**, each state is a named card. Walk a lane out loud: the name, the arrow's label, the next name. If that does not read as a sentence, something is wrong — usually a missing step.
- **Hover** a state to light the whole path through it and dim everything else. **Click** it to pin that and read its detail.

The arrows carry the actions. A solid blue one is the happy path in order; a dashed amber one leaves it; a dotted grey one returns to it. Every arrow has a head, so a branch and a rejoin are never the same picture. There is a legend in the bottom-left corner. Read the **waivers** carefully — "the roster is one query, so there is no half-loaded roster" is a claim about your product, and if it is wrong, that is a state nobody will build. A waiver can carry a _witness_ (a rule that would fail if the claim stopped holding) or a _review_ date; ask for one where you are unsure.

It ends red: `redspec status` lists every declared state that nothing renders. That is your work order for step 2.

## Step 2 — `/render-states`

Bring nothing; the skeleton is the input. Stubs turn into real screens one at a time.

Review the same board, now live. Zoom in past the card and each state frames the real screen, with its name above it.

**Read the name against the picture.** If they disagree, one of them is wrong, and that is the most valuable finding on the board. Click a state to see what its assertion says a reviewer should be able to say out loud — that sentence and the name are the same claim, one of them checkable, and they are read off things the machine already verifies, so neither can drift away from what it checks.

A state that ends a path says so underneath, in green: what the person is left with.

**Flows view**: is this the path? Is anything missing between two steps? Does every deviation have a way out? What is in the red _Not on any path_ lane — and what is in _Reached by a rule_, which is a state a decision table routes to rather than a flow? **Surfaces view**: twelve rows per screen, waivers struck through with their reasons — challenge the ones you do not believe. On each screen: is the copy right? Does an error name a cause and a way forward? Does an empty state offer the action that fills it?

Unpolished markup is not a finding. **Wrong words are, and so is the wrong shape.** The strings are the spec; they live in one place (`copy.ts`) and change in one place.

## Later: when something changes

Any change to a state, a flow, a waiver, a rule, or a line of copy after it has been built makes `redspec check` report it **amended** until someone re-signs it. Small changes get the same sign-off the original did — that is the point. Say `/amend <ID>`.

A waiver is reported against its screen's `SURFACE-` ID, and a copy edit against every state whose assertion asserts that string. Both are claims you signed; softening one quietly is exactly what the lock exists to prevent.

## What "done" looks like

Every declared state renders, is asserted, and sits on a flow. Every waived row has a reason you have read and believe. The adversary finds nothing that is neither built nor ruled out in the Brief. Then hand off: engineering runs `/implement-rules`, and your Brief, states, figures, and assertions are the input — a change to them comes back to you.
