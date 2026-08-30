---
name: cut-slices
description: "Break a spec into vertical slices, each claiming the spec artifacts it makes green."
disable-model-invocation: true
---

# Cut slices

Cut the spec into tracer bullets: narrow paths through every layer, each **claiming** the artifacts it turns green. An artifact claimed by nobody is a requirement nobody is building; `redspec check` finds it in a second.

## Process

1. **Collect the artifacts.** `redspec status --ids <slug>` lists every `STATE-`, `JOURNEY-`, `RULE-`, `INV-`. This list is the work. Nothing outside it gets built; nothing in it gets skipped.

2. **Draft vertical slices.** Each cuts a complete path through every layer it touches; is demoable alone; fits one fresh context window. Prefactoring comes first as its own slice. Give each its blocking edges.

3. **Assign claims.** Every artifact to exactly one slice: the one that first makes it green.

4. **Quiz the user.** Present the breakdown — title, blocked by, delivers, claims. Iterate until approved. **HITL.**

5. **Write the slice files.**

   ```
   redspec new slice <slug> <NN>-<name> --claims STATE-… RULE-…
   ```

   No file paths or code snippets in a slice; they go stale within a slice or two.

6. **Check coverage.** `redspec check`. Resolve every `orphan`, `claimless`, `unknown-id`, and `claimed-twice`.

## Done when

`redspec check` reports no coverage findings. Every artifact is claimed exactly once. The user approved the breakdown.

Then clear the window and run `/build-slice` on the first unblocked slice.
