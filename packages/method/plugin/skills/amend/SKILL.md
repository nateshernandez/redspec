---
name: amend
description: "Take an artifact that changed after it was verified back through only the steps it touches, and re-stamp it."
disable-model-invocation: true
---

# Amend

Something that was green moved. `redspec check` says **amended**: the artifact's content no longer matches the digest recorded when its slice was verified, and nothing has re-verified it since.

This skill is deliberately narrow. It takes IDs, not an idea. It does not re-run the interview. Small changes are where specs rot, because nobody treats a one-line change as spec work — so this is the one-line change treated as spec work.

## Process

1. **Read the finding.** `redspec status` names the artifact, the slice that verified it, when, and what moved. Decide which of two things this is.

2. **A clarification** — the wording changed, the behaviour did not:

   ```
   redspec accept <ID> --clarification "<what changed and why it is not behavioural>"
   ```

   This runs the verification command in the same invocation and refuses to stamp unless it passes. You cannot clarify your way past a real change.

3. **A real change** — the requirement moved:

   ```
   redspec new slice <slug> A<NN>-<name> --amends <ID> --claims <ID>
   ```

   Fill in **Because:**. Then re-run **only** the downstream steps the change touches, with the same sign-off the original got:
   - a `STATE-` or `COPY-`: re-render, re-assert, product re-signs on the board
   - a `JOURNEY-`: regenerate journeys, product re-signs the flows view
   - a `SURFACE-` (a waiver changed): product re-reads the waiver; build the state if it no longer holds
   - a `RULE-`/`INV-`: re-confirm the rung, re-prove it can fail

   Then `/build-slice` on the amendment slice, which stamps it.

4. **Dispatch the `spec-adversary`** over the changed artifact's neighbours. A change to one artifact usually implies a change to another that nobody made.

## Done when

`redspec check` reports no `amended` for this feature, and the lock's entry for every changed ID names the amendment slice or carries the clarification note.
