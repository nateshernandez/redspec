import { describe, expect, it } from "vitest"
import {
  analyzeDecisionTable,
  decide,
  parseDecisionTable,
  representativeInputs,
} from "./decision-table"

const total = `
## RULE-overtime-rate

**Inputs:** hours: number(0..), plan: {free, pro}
**Hit policy:** UNIQUE

| hours   | plan | multiplier | note        |
| ------- | ---- | ---------- | ----------- |
| [0..40] | -    | 1          | straight    |
| (40..]  | free | 1.5        | overtime    |
| (40..]  | pro  | 2          | pro rate    |
`

describe("decision tables", () => {
  it("parses inputs, policy, rules and outputs", () => {
    const t = parseDecisionTable(total)
    expect(t.id).toBe("RULE-overtime-rate")
    expect(t.inputs.map((i) => i.name)).toEqual(["hours", "plan"])
    expect(t.outputColumns).toEqual(["multiplier", "note"])
    expect(t.rules).toHaveLength(3)
    expect(t.rules[1]!.outputs).toEqual({ multiplier: "1.5", note: "overtime" })
  })

  it("proves a total table has no gaps and no overlaps", () => {
    const a = analyzeDecisionTable(parseDecisionTable(total))
    expect(a.gaps).toEqual([])
    expect(a.overlaps).toEqual([])
  })

  it("names the region a gap leaves uncovered", () => {
    const gappy = total.replace("| (40..]  | pro  | 2          | pro rate    |", "")
    const a = analyzeDecisionTable(parseDecisionTable(gappy))
    expect(a.gaps).toEqual(["hours ∈ (40..∞), plan = pro"])
  })

  it("names the rows that overlap under UNIQUE, and forgives them under FIRST", () => {
    const overlapping = total.replace("(40..]  | free", "[40..]  | free")
    const a = analyzeDecisionTable(parseDecisionTable(overlapping))
    expect(a.overlaps).toEqual([{ rules: [1, 2], where: "hours = 40, plan = free" }])
    const first = analyzeDecisionTable(
      parseDecisionTable(overlapping.replace("UNIQUE", "FIRST"))
    )
    expect(first.overlaps).toEqual([])
  })

  it("decides a concrete input, and returns null in a gap", () => {
    const t = parseDecisionTable(total)
    expect(decide(t, { hours: 41, plan: "pro" })).toEqual({
      multiplier: "2",
      note: "pro rate",
    })
    expect(decide(t, { hours: 40, plan: "pro" })).toEqual({
      multiplier: "1",
      note: "straight",
    })
    const gappy = parseDecisionTable(
      total.replace("| (40..]  | pro  | 2          | pro rate    |", "")
    )
    expect(decide(gappy, { hours: 50, plan: "pro" })).toBeNull()
  })

  it("yields one representative input per elementary region", () => {
    const inputs = representativeInputs(parseDecisionTable(total))
    // hours regions: 0, (0..40), 40, (40..∞)  ×  plan: free, pro
    expect(inputs).toHaveLength(8)
    expect(inputs).toContainEqual({ hours: 20, plan: "free" })
    expect(inputs).toContainEqual({ hours: 41, plan: "pro" })
  })

  it("reads booleans and comparisons", () => {
    const t = parseDecisionTable(
      `## RULE-x\n**Inputs:** n: number, admin: boolean\n| n | admin | out |\n|---|---|---|\n| < 0 | - | neg |\n| >= 0 | true | ok |\n| >= 0 | false | no |`
    )
    expect(analyzeDecisionTable(t).gaps).toEqual([])
    expect(decide(t, { n: 3, admin: false })).toEqual({ out: "no" })
  })

  it("explains what it cannot read", () => {
    expect(() => parseDecisionTable("## RULE-x\n| a |\n|---|\n| 1 |")).toThrow(/Inputs/)
    expect(() =>
      parseDecisionTable(
        "## RULE-x\n**Inputs:** plan: {free}\n| plan | o |\n|---|---|\n| gold | 1 |"
      )
    ).toThrow(/Row 1, column "plan"/)
  })
})
