import { describe, expect, it } from "vitest"
import { compileFlow, flowCoverage, simplePaths, unreachableStates } from "./graph"
import { demoSpec } from "./fixtures.test-helper"

describe("flow graph", () => {
  it("enumerates every simple path from the first step to an end", () => {
    const { paths, truncated } = simplePaths(compileFlow(demoSpec.flows[0]!))
    expect(truncated).toBe(false)
    // Happy path, and the path that deviates to loading, rejoins, and ends.
    expect(paths.map((p) => p.states)).toEqual([
      ["STATE-demo-roster-empty", "STATE-demo-roster-populated"],
    ])
    expect(paths[0]!.end).toBe("The roster lists everyone.")
  })

  it("a deviation that ends is its own path", () => {
    const flow = {
      ...demoSpec.flows[0]!,
      deviations: [
        {
          from: "STATE-demo-roster-empty",
          when: "Session expires",
          case: "STATE-demo-signed-out",
          end: "They sign back in.",
        },
      ],
    }
    const { paths } = simplePaths(compileFlow(flow))
    expect(paths).toHaveLength(2)
    expect(paths.map((p) => p.end).sort()).toEqual([
      "The roster lists everyone.",
      "They sign back in.",
    ])
  })

  it("a deviation off a missing step is unreachable", () => {
    const flow = {
      ...demoSpec.flows[0]!,
      deviations: [
        { from: "STATE-nowhere", when: "x", case: "STATE-demo-lost", end: "Lost." },
      ],
    }
    expect(unreachableStates(compileFlow(flow))).toEqual(["STATE-demo-lost"])
  })

  it("respects the path budget and says so", () => {
    const { truncated } = simplePaths(compileFlow(demoSpec.flows[0]!), 0)
    expect(truncated).toBe(true)
  })

  it("summarises coverage per flow", () => {
    expect(flowCoverage(demoSpec)).toEqual([
      {
        id: "JOURNEY-demo-view-roster",
        reachablePaths: 1,
        truncated: false,
        unreachable: [],
      },
    ])
  })
})
