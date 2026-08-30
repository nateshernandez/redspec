# Roadmap

Ordered by value over effort.

## Now

- [ ] Mount `@redspec/next` in an example app under `examples/next` and run both Playwright tiers in CI.
- [ ] `redspec check` in a pre-commit hook template, so degraded harnesses (Cursor, Copilot) still get the outcome gate.
- [ ] Copy lint: a bare string literal in `sketches.tsx` is a finding.

## Next

- [ ] State digest includes the `COPY-` entries a case renders (needs a render-time trace or a static import scan).
- [ ] Model-based runner helper for machine tables (`fc.commands` wiring), so the template's SUT hook is real.
- [ ] Journeys executed against a machine: generated paths that click through `on`/`when` labels mapped to actions.
- [ ] Merge adjacent elementary regions in gap reports (`x = 7` + `x ∈ (7..∞)` → `x ∈ [7..∞)`).
- [ ] `redspec board` PR previews with recorded sign-offs (the hosted product).

## Later

- [ ] A second framework adapter (Vite SPA) to find out which parts of the method are separable from the kit.
- [ ] Rung 0: a model-checker adapter (Quint) for the two or three rules a year that deserve it.
- [ ] Custom checklist row sets per repo (today the twelve are fixed by the type).
