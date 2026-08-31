import { describe, expect, it } from "vitest"
import {
  canonical,
  digestFlow,
  digestRule,
  digestSurface,
  normalizeText,
  registryDigests,
} from "./digest"
import { compareLock, emptyLock, serializeLock, stamp } from "./lock"
import { demoSpec } from "./fixtures.test-helper"

describe("digests", () => {
  it("are stable across key order and whitespace", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      canonical({ a: [{ c: 3, d: 2 }], b: 1 })
    )
    expect(digestRule("# R\n\n|a|b|\n|1|2|\n", null)).toBe(
      digestRule("# R\n|a|b|\n\n\n|1|2|", null)
    )
    expect(normalizeText("  a   b \n\n c ")).toBe("a b\nc")
  })
  it("move when a flow's meaning moves", () => {
    const flow = demoSpec.flows[0]!
    const before = digestFlow(flow)
    expect(digestFlow({ ...flow, title: "Renamed" })).toBe(before) // titles are not meaning
    expect(digestFlow({ ...flow, spine: [...flow.spine].reverse() })).not.toBe(before)
    expect(
      digestFlow({
        ...flow,
        spine: [
          { ...flow.spine[0]!, on: "Different label" } as (typeof flow.spine)[0],
          flow.spine[1]!,
        ],
      })
    ).not.toBe(before)
  })
  it("move when a waiver's reason moves, even though the row stays waived", () => {
    const surface = demoSpec.surfaces.roster!
    const before = digestSurface(surface)
    expect(
      digestSurface({
        ...surface,
        checklist: {
          ...surface.checklist,
          partial: { waived: "The roster is one query, for now." },
        },
      })
    ).not.toBe(before)
  })
})

describe("lock", () => {
  const digests = registryDigests(demoSpec)
  const ids = Object.keys(digests)

  it("stamps, serializes one entry per line, and reads back clean", () => {
    const lock = stamp(emptyLock(), ids, digests, "specs/demo/slices/01-roster.md", {
      at: new Date("2026-08-01T00:00:00Z"),
    })
    const text = serializeLock(lock)
    expect(text.split("\n").filter((l) => l.includes('"digest"'))).toHaveLength(
      ids.length
    )
    expect(JSON.parse(text)).toEqual(lock)
    expect(compareLock(lock, digests, {})).toEqual([])
  })

  it("reports an artifact that moved since it was verified as amended", () => {
    const lock = stamp(emptyLock(), ids, digests, "specs/demo/slices/01-roster.md")
    const moved = registryDigests({
      ...demoSpec,
      flows: [
        {
          ...demoSpec.flows[0]!,
          spine: [
            { case: "STATE-demo-roster-empty", on: "Changed" },
            demoSpec.flows[0]!.spine[1]!,
          ],
        },
      ],
    })
    expect(compareLock(lock, moved, {})).toEqual([
      expect.objectContaining({
        kind: "amended",
        id: "JOURNEY-demo-view-roster",
        at: "specs/demo/slices/01-roster.md",
      }),
    ])
  })

  it("reports a done slice that never stamped its claim", () => {
    expect(
      compareLock(emptyLock(), digests, {
        "JOURNEY-demo-view-roster": { slice: "s.md", done: true },
      })
    ).toEqual([
      expect.objectContaining({ kind: "unverified", id: "JOURNEY-demo-view-roster" }),
    ])
    expect(
      compareLock(emptyLock(), digests, {
        "JOURNEY-demo-view-roster": { slice: "s.md", done: false },
      })
    ).toEqual([])
  })

  it("refuses to stamp an ID nothing digests to", () => {
    expect(() => stamp(emptyLock(), ["RULE-nope"], digests, "s.md")).toThrow(/RULE-nope/)
  })
})

describe("what a surface digest covers", () => {
  it("moves when the screen's own name changes", () => {
    // The board says this name to a reviewer on every chip and lane header,
    // so renaming it after sign-off has to come back as amended.
    const renamed = {
      ...demoSpec,
      surfaces: {
        roster: { ...demoSpec.surfaces.roster!, title: "Public roster" },
      },
    }
    expect(registryDigests(renamed)["SURFACE-demo-roster"]).not.toBe(
      registryDigests(demoSpec)["SURFACE-demo-roster"]
    )
  })

  it("moves when a waiver reason is softened", () => {
    const softened = {
      ...demoSpec,
      surfaces: {
        roster: {
          ...demoSpec.surfaces.roster!,
          checklist: {
            ...demoSpec.surfaces.roster!.checklist,
            partial: { waived: "Usually one query.", witness: "INV-demo-single-query" },
          },
        },
      },
    }
    expect(registryDigests(softened)["SURFACE-demo-roster"]).not.toBe(
      registryDigests(demoSpec)["SURFACE-demo-roster"]
    )
  })
})
