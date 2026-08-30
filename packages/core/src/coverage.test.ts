import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { reportBundle, unregisteredBundles } from "./coverage"
import { loadConfig, loadSpecs } from "./load"
import { kinds } from "./fixtures.test-helper"

const root = join(import.meta.dirname, "__fixtures__/repo")

describe("loading a repo", () => {
  it("reads spec.config.ts with defaults filled in", async () => {
    const { config, path } = await loadConfig(root)
    expect(path).toMatch(/spec\.config\.ts$/)
    expect(config.framework).toBe("next")
    expect(config.route).toBe("/spec")
    expect(config.harnesses).toEqual(["claude", "cursor"])
  })

  it("loads spec.ts through jiti, JSX sketches and all", async () => {
    const { config } = await loadConfig(root)
    const specs = await loadSpecs(root, config)
    expect(specs.map((s) => s.spec.slug)).toEqual(["demo"])
    expect(Object.keys(specs[0]!.spec.cases)).toHaveLength(2)
  })

  it("names a bundle directory with no spec file", async () => {
    const { config } = await loadConfig(root)
    const specs = await loadSpecs(root, config)
    expect(unregisteredBundles(root, config, specs)).toEqual([
      expect.objectContaining({ kind: "unregistered-feature", id: "stray" }),
    ])
  })
})

describe("reportBundle", () => {
  it("finds everything the fixture was built to be wrong about", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const report = reportBundle(root, config, demo!, new Date("2026-08-29"))
    const found = kinds(report.findings)

    expect(found).toContain("declared-not-rendered") // STATE-demo-roster-loading
    expect(found).toContain("waiver-due") // overflowing, review 2020-01-01
    expect(found).toContain("actor-without-flow") // Auditor
    expect(found).toContain("unknown-witness") // INV-demo-single-query has no file
    expect(found).toContain("table-gap") // cooldown table: [7..] pro
    expect(found).toContain("unknown-id") // RULE-demo-not-a-rule
    expect(found).toContain("claimless") // 02-nothing.md
    expect(found).toContain("orphan") // RULE-demo-invite-cooldown claimed by nobody
    expect(found).toContain("unverified") // 01-roster is done, never stamped

    // Two elementary regions are uncovered for `pro`: the boundary point and everything past it.
    expect(
      report.findings.filter((f) => f.kind === "table-gap").map((f) => f.detail)
    ).toEqual([
      "daysSinceInvite = 7, plan = pro is matched by no row.",
      "daysSinceInvite ∈ (7..∞), plan = pro is matched by no row.",
    ])
    expect(report.findings.find((f) => f.kind === "actor-without-flow")?.id).toBe(
      "Auditor"
    )
  })

  it("digests every artifact it knows about", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const report = reportBundle(root, config, demo!)
    expect(Object.keys(report.digests).sort()).toEqual([
      "JOURNEY-demo-view-roster",
      "RULE-demo-invite-cooldown",
      "RULE-demo-roster-order",
      "STATE-demo-roster-empty",
      "STATE-demo-roster-loading",
      "STATE-demo-roster-populated",
      "SURFACE-demo-roster",
    ])
  })

  it("folds the state assertion into the state's digest", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const a = reportBundle(root, config, demo!).digests
    // The fixture asserts only the empty state; loading and populated digest
    // to the surface/row alone and so differ from empty by the assertion.
    expect(a["STATE-demo-roster-empty"]).not.toBe(a["STATE-demo-roster-populated"])
  })
})
