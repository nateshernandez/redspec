import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { declaredStateIds } from "./audit"
import { flowsBoard, surfacesBoard, NODE_BELOW_H } from "./board-layout"
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

describe("what a node says in words", () => {
  it("says what the person is looking at, in the words the spec declares", () => {
    const board = flowsBoard(demoSpec, {
      assertions: { "STATE-demo-roster-populated": "lists everyone on the roster" },
    })
    const node = board.nodes.find(
      (n) => n.data.stateId === "STATE-demo-roster-populated" && n.type === "spec"
    )!
    expect(node.data.name).toBe("Three teammates, each with their access level")
    expect(node.data.checklistRow).toBe("Populated")
    expect(node.data.family).toBe("settled")
    // Detail on demand, once /render-states has written it.
    expect(node.data.assertion).toBe("lists everyone on the roster")
  })

  it("falls back to the ID only when nothing named the state", () => {
    const unnamed: Spec = { ...demoSpec, states: {} }
    const node = flowsBoard(unnamed).nodes.find((n) => n.type === "spec")!
    expect(node.data.name).toBe(node.data.stateId)
  })

  it("never repeats an edge label on the node the edge points at", () => {
    const board = flowsBoard(demoSpec)
    const labels = new Set(board.edges.map((e) => e.label).filter(Boolean))
    for (const node of board.nodes) {
      expect(labels.has(node.data.name)).toBe(false)
      expect(node.data).not.toHaveProperty("arrivedBy")
    }
  })

  it("keeps the row's gloss for the surfaces view, where it is the question", () => {
    const board = surfacesBoard(demoSpec)
    const waiver = board.nodes.find((n) => n.data.kind === "waiver")!
    expect(waiver.data.asks).toBeTruthy()
    expect(board.nodes.find((n) => n.id === "roster:conflict")!.data.asks).toBe(
      "someone else changed it underneath"
    )
    // ...and leaves it off the flows view, where the graph already says it.
    expect(flowsBoard(demoSpec).nodes.every((n) => n.data.asks === undefined)).toBe(true)
  })

  it("gives a lane the journey's shape instead of its ID", () => {
    const lane = flowsBoard(demoSpec).nodes.find((n) => n.type === "lane")!
    expect(lane.data.label).toBe("See who has access")
    expect(lane.data.sublabel).toContain("Firm owner")
    expect(lane.data.sublabel).toContain("2 steps")
    expect(lane.data.sublabel).toContain("1 branch")
    expect(lane.data.sublabel).not.toContain("JOURNEY-")
  })

  it("sizes a lane band around everything in it", () => {
    const board = flowsBoard(demoSpec)
    const lane = board.nodes.find((n) => n.type === "lane")!
    for (const node of board.nodes.filter((n) => n.type === "spec")) {
      expect(node.position.x).toBeGreaterThanOrEqual(lane.position.x)
      expect(node.position.y).toBeGreaterThanOrEqual(lane.position.y)
      expect(node.position.x + node.width).toBeLessThanOrEqual(
        lane.position.x + lane.width
      )
      expect(node.position.y + node.height).toBeLessThanOrEqual(
        lane.position.y + lane.height
      )
    }
  })
})

describe("states a rule routes to", () => {
  const offFlow: Spec = {
    ...demoSpec,
    flows: demoSpec.flows.map((f) => ({ ...f, spine: [f.spine[0]!], deviations: [] })),
  }

  it("gets its own lane instead of the red one", () => {
    const board = flowsBoard(offFlow, {
      resolvedStates: new Set(["STATE-demo-roster-populated"]),
    })
    expect(board.nodes.some((n) => n.id === "lane:by-rule")).toBe(true)
    expect(board.nodes.some((n) => n.id === "rule:STATE-demo-roster-populated")).toBe(
      true
    )
    expect(board.nodes.some((n) => n.id === "off:STATE-demo-roster-populated")).toBe(
      false
    )
  })

  it("leaves the red lane for what nothing reaches at all", () => {
    const board = flowsBoard(offFlow)
    expect(board.nodes.some((n) => n.id === "lane:by-rule")).toBe(false)
    expect(board.nodes.find((n) => n.id === "lane:off-path")!.data.tone).toBe("alarm")
  })

  it("does not overlap the two lanes", () => {
    const board = flowsBoard(offFlow, {
      resolvedStates: new Set(["STATE-demo-roster-populated"]),
    })
    const byRule = board.nodes.find((n) => n.id === "lane:by-rule")!
    const offPath = board.nodes.find((n) => n.id === "lane:off-path")
    if (offPath) expect(offPath.position.y).toBeGreaterThan(byRule.position.y)
  })
})

describe("room for the words under a node", () => {
  // A node draws its caption and terminal note below its box. If the layout
  // does not reserve that height, the words land on the node underneath --
  // invisible to every test that only looks at node positions.
  const clears = (board: ReturnType<typeof flowsBoard>) => {
    const boxes = board.nodes
      .filter((n) => n.type === "spec")
      .map((n) => ({ id: n.id, top: n.position.y, x: n.position.x, h: n.height }))
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || a.x !== b.x) continue
        if (b.top <= a.top) continue
        expect(
          b.top - (a.top + a.h),
          `${a.id} needs ${NODE_BELOW_H}px under it before ${b.id}`
        ).toBeGreaterThanOrEqual(NODE_BELOW_H)
      }
    }
  }

  it("keeps a full caption clear of the node below it, on both views", () => {
    clears(flowsBoard(demoSpec))
    clears(surfacesBoard(demoSpec))
  })

  it("keeps stacked deviations clear of each other", () => {
    const stacked: Spec = {
      ...demoSpec,
      flows: [
        {
          ...demoSpec.flows[0]!,
          deviations: [
            {
              from: "STATE-demo-roster-empty",
              when: "One",
              case: "STATE-demo-roster-loading",
              end: "Waits.",
            },
            {
              from: "STATE-demo-roster-empty",
              when: "Two",
              case: "STATE-demo-roster-populated",
              end: "Waits.",
            },
          ],
        },
      ],
    }
    clears(flowsBoard(stacked))
  })
})
