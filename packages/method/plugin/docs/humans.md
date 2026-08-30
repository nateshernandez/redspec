# Speccing a feature: the two steps you own

For the person running `/draft-skeleton` and `/render-states`. The agent-facing conventions are in `docs/agents/redspec.md`; you do not need them.

Steps 1 and 2 are product's. Steps 3 to 5 are engineering's. Neither side reviews the other's work on their behalf, so what you sign off in these two steps is what the rest of the flow is built from. **Clear the agent's window between steps** — each one starts from the files, not the conversation, and a step that cannot start cold means the last one left something unsaid.

## Step 1 — `/draft-skeleton`

Bring an idea at whatever resolution you have it. The agent interviews you hard; answer, or say "unknown" and it gets recorded as one. Then it sorts every fact into a file and shows you the sorted list before writing anything.

You review two things. **The Brief** (`{{specsDir}}/<feature>/BRIEF.md`) — one page; its most valuable sections are Non-goals and Deliberate unknowns. **The skeleton**, on the board at `{{route}}/<feature>`: every declared state is a dashed stub carrying an ID, its screen, and its checklist row. You are signing the shape, not the pixels. Read the **waivers** carefully — "the roster is one query, so there is no half-loaded roster" is a claim about your product, and if it is wrong, that is a state nobody will build. A waiver can carry a _witness_ (a rule that would fail if the claim stopped holding) or a _review_ date; ask for one where you are unsure.

It ends red: `redspec status` lists every declared state that nothing renders. That is your work order for step 2.

## Step 2 — `/render-states`

Bring nothing; the skeleton is the input. Stubs turn into real screens one at a time.

Review the same board, now live. **Flows view**: is this the path? Is anything missing between two steps? Does every deviation have a way out? What is in the red _Not on any path_ lane? **Surfaces view**: twelve rows per screen, waivers struck through with their reasons — challenge the ones you do not believe. On each screen: is the copy right? Does an error name a cause and a way forward? Does an empty state offer the action that fills it?

Unpolished markup is not a finding. **Wrong words are, and so is the wrong shape.** The strings are the spec; they live in one place (`copy.ts`) and change in one place.

## Later: when something changes

Any change to a state, a flow, a waiver, a rule, or a line of copy after it has been built makes `redspec check` report it **amended** until someone re-signs it. Small changes get the same sign-off the original did — that is the point. Say `/amend <ID>`.

## What "done" looks like

Every declared state renders, is asserted, and sits on a flow. Every waived row has a reason you have read and believe. The adversary finds nothing that is neither built nor ruled out in the Brief. Then hand off: engineering runs `/implement-rules`, and your Brief, states, figures, and assertions are the input — a change to them comes back to you.
