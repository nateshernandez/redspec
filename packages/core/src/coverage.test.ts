import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { assertionBlocks, copyIdsIn, reportBundle, unregisteredBundles } from "./coverage"
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

  it("names a COPY id an assertion asserts against and the catalog does not have", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const report = reportBundle(root, config, demo!)
    expect(report.findings).toContainEqual(
      expect.objectContaining({ kind: "unknown-copy", id: "COPY-demo-roster-gone" })
    )
  })
})

describe("copyIdsIn", () => {
  it("takes the COPY ids out of source and leaves everything else", () => {
    expect(
      copyIdsIn(`copy["COPY-demo-b"] + copy["COPY-demo-a"] + copy["COPY-demo-b"]`)
    ).toEqual(["COPY-demo-a", "COPY-demo-b"])
    expect(copyIdsIn("no ids here")).toEqual([])
    expect(copyIdsIn(null)).toEqual([])
  })
})

describe("finding where an assertion ends", () => {
  it("is not truncated by a paren inside a string", () => {
    const source = `
test("STATE-demo-a offers the action", async ({ page }) => {
  await expect(page.getByText("all done :)")).toBeVisible()
  await expect(page.getByText(copy["COPY-demo-a"])).toBeVisible()
})
`
    const block = assertionBlocks(source, "STATE-demo-a")!
    expect(block).toContain("COPY-demo-a")
    expect(copyIdsIn(block)).toEqual(["COPY-demo-a"])
  })

  it("is not run on to EOF by an unbalanced paren inside a string", () => {
    const source = `
test("STATE-demo-a renders", async ({ page }) => {
  await expect(page.getByText("smile (")).toBeVisible()
})

test("STATE-demo-b renders", async ({ page }) => {
  await expect(page.getByText(copy["COPY-demo-b"])).toBeVisible()
})
`
    // A swallowed neighbour would put B's contract in A's digest, so editing
    // B would amend A and A's copy set would be wrong.
    expect(assertionBlocks(source, "STATE-demo-a")).not.toContain("COPY-demo-b")
    expect(copyIdsIn(assertionBlocks(source, "STATE-demo-a"))).toEqual([])
    expect(copyIdsIn(assertionBlocks(source, "STATE-demo-b"))).toEqual(["COPY-demo-b"])
  })

  it("reads past parens in comments, regex literals, and template holes", () => {
    const source = `
test("STATE-demo-a renders", async ({ page }) => {
  // a stray ( in a comment
  /* and ( another */
  await expect(page.getByText(/no one \\(yet\\)/i)).toBeVisible()
  await expect(page.getByText(\`\${count(1)} left (of many\`)).toBeVisible()
  await expect(page.getByText(copy["COPY-demo-a"])).toBeVisible()
})
`
    expect(copyIdsIn(assertionBlocks(source, "STATE-demo-a"))).toEqual(["COPY-demo-a"])
  })

  it("reads a COPY id only where it is quoted", () => {
    expect(copyIdsIn(`// renamed from COPY-demo-old\ncopy["COPY-demo-new"]`)).toEqual([
      "COPY-demo-new",
    ])
    expect(copyIdsIn("// see https://example.test/COPY-demo-legacy")).toEqual([])
  })
})
