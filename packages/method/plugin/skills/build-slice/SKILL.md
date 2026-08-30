---
name: build-slice
description: "Implement one slice until its claimed artifacts are green, stamp them, then open a PR."
disable-model-invocation: true
---

# Build slice

Build **one** slice. Its claimed artifacts are the definition of done.

Start from a fresh window: the slice file plus the artifacts it claims is everything needed.

## Process

1. **Load the slice.** Read it and every artifact it claims. Run them; watch them fail. A claimed artifact already green means the slice is smaller than it looks, or claims something another slice built.

2. **Build, red to green.** Use the `tdd` skill if available. The artifacts are the red half already written; the loop is picking the next claimed ID and making it pass.

3. **Promote the sketch.** Where the slice claims a `STATE-`, graduate the case's markup into `components/` as the feature's presentational layer; wire real data through it. The case and fixture stay in place. **The assertions stay unchanged** — one that must be rewritten was describing the sketch; raise it to user intent and note it for the PR. A screenshot baseline that moves is an approved appearance changing: say what moved and why. Never reach for `--update-snapshots` to quiet a baseline you did not mean to change.

4. **Verify against the claims.** Run the full claimed set plus typecheck and lint. Dispatch the `slice-verifier` agent with the diff and the slice file. Work every finding.

5. **Stamp.** Mark the slice `**Status:** done`, then

   ```
   redspec accept --slice specs/<slug>/slices/<NN>-<name>.md
   ```

   which runs the configured verification command and stamps every claim only if it passes. `redspec check` must be clean for this feature afterwards.

6. **Review and ship.** Use the `code-review` skill if available. Commit to a branch named for the slice; open a PR whose body carries: what the slice delivers, the ticked claim checklist, any assertion rewritten during promotion, and anything the spec failed to say.

## Done when

Every claimed artifact is green and stamped. Typecheck, lint, and the full suite pass. Every `STATE-` claimed renders from production components. The verifier's findings are worked. The PR body carries the ticked checklist.

Then clear the window and run `/build-slice` on the next unblocked slice.
