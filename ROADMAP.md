# Roadmap

Ordered by value over effort.

## Now

- [ ] Mount `@redspec/next` in an example app under `examples/next` and run both Playwright tiers in CI.
- [ ] `redspec check` in a pre-commit hook template, so degraded harnesses (Cursor, Copilot) still get the outcome gate.
- [ ] Copy lint: a bare string literal in `sketches.tsx` is a finding.

## Next

- [ ] Widen the state's copy digest from the entries its **assertion** names to the entries its sketch **renders** (needs a render-time trace or a static import scan). Today a string nothing asserts is not in the contract, which is defensible but leaves promoted copy unwatched.
- [ ] Model-based runner helper for machine tables (`fc.commands` wiring), so the template's SUT hook is real.
- [ ] Journeys executed against a machine: generated paths that click through `on`/`when` labels mapped to actions.
- [ ] Merge adjacent elementary regions in gap reports (`x = 7` + `x ∈ (7..∞)` → `x ∈ [7..∞)`).
- [ ] `redspec board` PR previews with recorded sign-offs (the hosted product).

## Later

- [ ] A second framework adapter (Vite SPA) to find out which parts of the method are separable from the kit.
- [ ] Rung 0: a model-checker adapter (Quint) for the two or three rules a year that deserve it.
- [ ] ~~Custom checklist row sets per repo~~ — **decided against.** The twelve rows are worth most precisely because they are not a preference: a pre-collapsed taxonomy that transfers between features and teams, where `overflowing` and `stale` are the rows nobody declares and everybody needs. A repo that can delete rows deletes those. Where a screen genuinely turns on a combination the rows flatten, the answer is a resolution table, which declares its own dimensions, proves the cross product total, and lands back in the twelve via `off-checklist`. Reopen only with evidence of a real feature the rows cannot express.
- [ ] Render a resolution table on the board as a grid of faces — the cross product with each cell's live case in it. Needs rules to reach `@redspec/next`, which today only sees the registry.
- [ ] Migrate locks across a `DIGEST_ALGO` bump instead of reporting every artifact `amended` once (`compareLock` does not read `algo` yet).
