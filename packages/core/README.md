# @redspec/core

The types a feature declares, and everything that can be derived from them.

```ts
import { defineSpec, defineCopy } from "@redspec/core"
```

- `defineSpec` / `Spec` — surfaces (twelve-row checklist, each row a state or a waiver with optional `witness`/`review`), cases, flows.
- `auditSpec(spec)` — the registry against itself: declared-not-rendered, off-path, off-checklist, surface-mismatch, dangling deviations, spine shape, waiver dates.
- `compileFlow` / `simplePaths` / `flowCoverage` — a flow as a graph: reachability and path enumeration.
- `digestFlow` / `digestSurface` / `digestRule` / `digestState` — what "this changed" means per kind.
- `readLock` / `stamp` / `compareLock` — the `.spec-lock.json` and the `amended` finding.
- `parseDecisionTable` / `analyzeDecisionTable` / `decide` / `representativeInputs` — total decision tables with gap and overlap analysis.
- `reportBundle(root, config, loaded)` — everything above over one `specs/<slug>/` directory, plus coverage.
- `flowsBoard` / `surfacesBoard` — derived board geometry; never authored.
