import { describe, expect, it } from "vitest"
import { auditSpec, declaredStateIds } from "./audit"
import { demoSpec, kinds } from "./fixtures.test-helper"
import type { Spec } from "./types"

/** The demo, with the empty state rendered but on no flow. */
const offFlow = (): Spec => ({
  ...demoSpec,
  flows: demoSpec.flows.map((f) => ({
    ...f,
    spine: f.spine.filter((s) => s.case !== "STATE-demo-roster-empty"),
    deviations: f.deviations.filter((d) => d.from !== "STATE-demo-roster-empty"),
  })),
})

describe("auditSpec", () => {
  it("reports the one unrendered state as declared, not as a typo", () => {
    expect(auditSpec(demoSpec)).toEqual([
      {
        kind: "declared-not-rendered",
        id: "STATE-demo-roster-loading",
        detail:
          "Declared by a checklist row and walked by a flow; no case renders it yet.",
      },
    ])
  })

  it("goes red when a rendered case is taken off its flow", () => {
    expect(kinds(auditSpec(offFlow()))).toContain("off-path")
  })

  it("counts a state a resolution table routes to as reached", () => {
    // A rule that names which state you land in is a producer, exactly as a
    // flow step is. It does not excuse the state from the twelve rows.
    const findings = auditSpec(offFlow(), {
      resolvedStates: new Set(["STATE-demo-roster-empty"]),
    })
    expect(kinds(findings)).not.toContain("off-path")
    expect(kinds(findings)).not.toContain("off-checklist")
  })

  it("ignores a resolved state the spec does not declare", () => {
    // Coverage reports that as `unknown-state-outcome` against the rule; the
    // audit must not also invent an off-checklist finding for a ghost.
    const findings = auditSpec(demoSpec, {
      resolvedStates: new Set(["STATE-demo-nowhere"]),
    })
    expect(findings.map((f) => f.id)).not.toContain("STATE-demo-nowhere")
  })

  it("goes red when a case names a surface the spec does not declare", () => {
    const mistyped: Spec = {
      ...demoSpec,
      cases: {
        ...demoSpec.cases,
        "STATE-demo-roster-empty": {
          ...demoSpec.cases["STATE-demo-roster-empty"]!,
          surface: "rostr",
        },
      },
    }
    expect(kinds(auditSpec(mistyped))).toContain("unknown-surface")
  })

  it("catches a state that is on a flow but on no checklist row", () => {
    const ghost: Spec = {
      ...demoSpec,
      cases: {
        ...demoSpec.cases,
        "STATE-demo-roster-ghost": { surface: "roster", render: () => null },
      },
      flows: [
        {
          ...demoSpec.flows[0]!,
          spine: [
            demoSpec.flows[0]!.spine[0]!,
            { case: "STATE-demo-roster-ghost", on: "next" },
            demoSpec.flows[0]!.spine[1]!,
          ],
        },
      ],
    }
    expect(auditSpec(ghost)).toContainEqual(
      expect.objectContaining({ kind: "off-checklist", id: "STATE-demo-roster-ghost" })
    )
  })

  it("catches a case and a checklist row that disagree about the surface", () => {
    const disagree: Spec = {
      ...demoSpec,
      surfaces: { ...demoSpec.surfaces, other: demoSpec.surfaces.roster! },
      cases: {
        ...demoSpec.cases,
        "STATE-demo-roster-empty": {
          ...demoSpec.cases["STATE-demo-roster-empty"]!,
          surface: "other",
        },
      },
    }
    expect(kinds(auditSpec(disagree))).toContain("surface-mismatch")
  })

  it("catches a spine that ends before its last step, and one that never ends", () => {
    const early: Spec = {
      ...demoSpec,
      flows: [
        {
          ...demoSpec.flows[0]!,
          spine: [
            { case: "STATE-demo-roster-empty", end: "Stops." },
            { case: "STATE-demo-roster-populated", end: "And here." },
          ],
        },
      ],
    }
    expect(kinds(auditSpec(early))).toContain("spine-ends-early")
    const never: Spec = {
      ...demoSpec,
      flows: [
        {
          ...demoSpec.flows[0]!,
          spine: [
            { case: "STATE-demo-roster-empty", on: "next" },
            { case: "STATE-demo-roster-populated", on: "and on" },
          ],
        },
      ],
    }
    expect(kinds(auditSpec(never))).toContain("spine-ends-early")
  })

  it("names an empty spine rather than reporting its states as off-path", () => {
    const empty: Spec = {
      ...demoSpec,
      flows: [{ ...demoSpec.flows[0]!, spine: [], deviations: [] }],
    }
    expect(kinds(auditSpec(empty))).toContain("empty-spine")
  })

  it("catches a deviation branching off a step its flow never reaches", () => {
    const dangling: Spec = {
      ...demoSpec,
      flows: demoSpec.flows.map((f) => ({
        ...f,
        deviations: f.deviations.map((d) => ({
          ...d,
          from: "STATE-demo-roster-nowhere",
        })),
      })),
    }
    expect(kinds(auditSpec(dangling))).toContain("dangling-deviation")
  })

  it("reports a waiver whose review date has passed", () => {
    const due: Spec = {
      ...demoSpec,
      surfaces: {
        roster: {
          ...demoSpec.surfaces.roster!,
          checklist: {
            ...demoSpec.surfaces.roster!.checklist,
            stale: { waived: "Reads are live.", review: "2026-01-01" },
          },
        },
      },
    }
    expect(kinds(auditSpec(due, { now: new Date("2026-06-01") }))).toContain("waiver-due")
    expect(kinds(auditSpec(due, { now: new Date("2025-06-01") }))).not.toContain(
      "waiver-due"
    )
  })

  it("can require every waiver to name a witness", () => {
    expect(kinds(auditSpec(demoSpec, { requireWitness: true }))).toContain(
      "waiver-unwitnessed"
    )
  })

  it("catches a state declared with nothing but an ID", () => {
    const nameless: Spec = { ...demoSpec, states: {} }
    const found = auditSpec(nameless).filter((f) => f.kind === "unnamed-state")
    expect(found.map((f) => f.id).sort()).toEqual(declaredStateIds(demoSpec).sort())
  })

  it("catches a name that only restates the row or the ID", () => {
    const lazy: Spec = {
      ...demoSpec,
      states: {
        ...demoSpec.states,
        // The row is already drawn beside it; saying it twice says nothing.
        "STATE-demo-roster-empty": "Empty",
        // ...and neither does spelling the ID back out.
        "STATE-demo-roster-loading": "roster loading",
      },
    }
    const found = auditSpec(lazy).filter((f) => f.kind === "unnamed-state")
    expect(found.map((f) => f.id).sort()).toEqual([
      "STATE-demo-roster-empty",
      "STATE-demo-roster-loading",
    ])
  })

  it("says nothing about a name that describes the screen", () => {
    expect(kinds(auditSpec(demoSpec))).not.toContain("unnamed-state")
  })

  it("rejects IDs that break the convention", () => {
    const bad: Spec = {
      ...demoSpec,
      cases: {
        ...demoSpec.cases,
        "STATE-Demo-Roster_Big": { surface: "roster", render: () => null },
      },
    }
    expect(auditSpec(bad)).toContainEqual(
      expect.objectContaining({ kind: "bad-id", id: "STATE-Demo-Roster_Big" })
    )
  })
})
