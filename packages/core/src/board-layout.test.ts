import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { declaredStateIds } from "./audit"
import { flowsBoard, surfacesBoard } from "./board-layout"
import { CHECKLIST_ROWS } from "./checklist"
import { demoSpec } from "./fixtures.test-helper"
import type { ChecklistAnswer, ChecklistRow, FlowDeviation, Spec } from "./types"

const ID_POOL = ["STATE-a", "STATE-b", "STATE-c", "STATE-d", "STATE-e"] as const

// Specs across the whole range of the flow's life, deviations included --
// dangling ones too, since those take the branch the layout has to park.
const arbSpec = fc
  .record({
    spine: fc.uniqueArray(fc.constantFrom(...ID_POOL), {
      minLength: 1,
      maxLength: ID_POOL.length,
    }),
    rendered: fc.subarray([...ID_POOL]),
    checklisted: fc.subarray([...ID_POOL]),
    deviations: fc.array(
      fc.record({
        from: fc.constantFrom(...ID_POOL, "STATE-nowhere"),
        case: fc.constantFrom(...ID_POOL, "STATE-x", "STATE-y"),
        rejoin: fc.boolean(),
      }),
      { maxLength: 6 }
    ),
  })
  .map(({ spine, rendered, checklisted, deviations }): Spec => {
    const checklist = Object.fromEntries(
      CHECKLIST_ROWS.map(({ row }, i): [ChecklistRow, ChecklistAnswer] => [
        row,
        checklisted[i] ? { state: checklisted[i]! } : { waived: "Not possible" },
      ])
    ) as Record<ChecklistRow, ChecklistAnswer>
    return {
      slug: "generated",
      title: "Generated",
      surfaces: { screen: { title: "Screen", checklist } },
      states: Object.fromEntries(
        [...ID_POOL, "STATE-nowhere", "STATE-x", "STATE-y"].map((id) => [
          id,
          `What ${id} looks like`,
        ])
      ),
      cases: Object.fromEntries(
        rendered.map((id) => [id, { surface: "screen", render: () => null }])
      ),
      flows: [
        {
          id: "JOURNEY-generated",
          title: "Generated",
          actor: "Someone",
          spine: spine.map((id, i) =>
            i === spine.length - 1
              ? { case: id, end: "Done." }
              : { case: id, on: "Continues" }
          ),
          deviations: deviations.map((d): FlowDeviation =>
            d.rejoin
              ? { from: d.from, when: "w", case: d.case, rejoins: spine[0]! }
              : { from: d.from, when: "w", case: d.case, end: "e" }
          ),
        },
      ],
    }
  })

describe("INV-board-draws-every-declared-state", () => {
  it("draws a node for every declared state, however few render", () => {
    fc.assert(
      fc.property(arbSpec, (spec) => {
        const drawn = new Set(
          flowsBoard(spec)
            .nodes.map((n) => n.data.stateId)
            .filter((id): id is string => !!id)
        )
        for (const id of declaredStateIds(spec)) expect(drawn).toContain(id)
      })
    )
  })

  it("answers all twelve rows of every surface in the surfaces view", () => {
    fc.assert(
      fc.property(arbSpec, (spec) => {
        const cells = surfacesBoard(spec).nodes.filter((n) => n.type === "spec")
        expect(cells).toHaveLength(
          Object.keys(spec.surfaces).length * CHECKLIST_ROWS.length
        )
      })
    )
  })

  it("never places two nodes on the same point, dangling deviations included", () => {
    fc.assert(
      fc.property(arbSpec, (spec) => {
        for (const board of [flowsBoard(spec), surfacesBoard(spec)]) {
          const points = board.nodes.map((n) => `${n.position.x},${n.position.y}`)
          expect(new Set(points).size).toBe(points.length)
        }
      })
    )
  })
})

describe("the shape /draft-skeleton hands over", () => {
  const skeleton: Spec = { ...demoSpec, cases: {} }

  it("still draws every declared state, all of them as stubs", () => {
    const drawn = flowsBoard(skeleton).nodes.filter((n) => n.data.stateId !== undefined)
    expect(drawn.map((n) => n.data.stateId).sort()).toEqual(
      declaredStateIds(demoSpec).sort()
    )
    expect(drawn.every((n) => n.data.kind === "stub")).toBe(true)
  })

  it("still draws the flow with every step and deviation on it", () => {
    const board = flowsBoard(skeleton)
    const flow = demoSpec.flows[0]!
    expect(board.nodes.some((n) => n.id === `lane:${flow.id}`)).toBe(true)
    expect(board.edges.filter((e) => e.kind === "spine")).toHaveLength(
      flow.spine.length - 1
    )
    expect(board.edges.filter((e) => e.kind === "deviation")).toHaveLength(
      flow.deviations.length
    )
    expect(board.edges.filter((e) => e.kind === "rejoin")).toHaveLength(
      flow.deviations.filter((d) => d.rejoins).length
    )
  })
})
