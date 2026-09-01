import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  assertionBlocks,
  assertionIntent,
  copyIdsIn,
  readResolvedStates,
  readStateAssertions,
  publishedBoard,
  PUBLISH_BOARD_ENV,
  reportBundle,
  unregisteredBundles,
} from "./coverage"
import { digestState } from "./digest"
import { defineSpecConfig } from "./config"
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

describe("publishing the board", () => {
  const on = { [PUBLISH_BOARD_ENV]: "1" }

  it("is closed by default", () => {
    expect(defineSpecConfig().publicBoard).toBe(false)
  })

  it("reports the switch thrown without the intent declared", () => {
    expect(publishedBoard(defineSpecConfig(), on)).toEqual([
      expect.objectContaining({ kind: "board-published", at: "spec.config.ts" }),
    ])
  })

  it("says nothing when the repo declares it", () => {
    expect(publishedBoard(defineSpecConfig({ publicBoard: true }), on)).toEqual([])
  })

  it("says nothing when the switch is off, declared or not", () => {
    expect(publishedBoard(defineSpecConfig(), {})).toEqual([])
    expect(publishedBoard(defineSpecConfig({ publicBoard: true }), {})).toEqual([])
  })

  it("takes only an exact 1, so a stray truthy string does not open the gate", () => {
    for (const v of ["true", "yes", "0", ""])
      expect(publishedBoard(defineSpecConfig(), { [PUBLISH_BOARD_ENV]: v })).toEqual([])
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
      "RULE-demo-invite-resolution",
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

  it("folds the words a state asserts into its digest", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    expect(demo!.copy).toMatchObject({ "COPY-demo-roster-empty": "No one here but you" })

    const report = reportBundle(root, config, demo!)
    const source = readFileSync(join(root, "e2e/state/demo.spec.ts"), "utf8")
    const id = "STATE-demo-roster-empty"

    // The digest is exactly the one the state's own content produces, with the
    // asserted copy in it -- so editing the string amends the state.
    expect(report.digests[id]).toBe(
      digestState({
        surface: "roster",
        row: "empty",
        name: "No teammates yet, and one Invite button",
        assertion: assertionBlocks(source, id),
        baseline: null,
        copy: { "COPY-demo-roster-empty": "No one here but you" },
      })
    )
    expect(report.digests[id]).not.toBe(
      digestState({
        surface: "roster",
        row: "empty",
        name: "No teammates yet, and one Invite button",
        assertion: assertionBlocks(source, id),
        baseline: null,
        copy: { "COPY-demo-roster-empty": "Nobody here but you" },
      })
    )
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

describe("resolution tables", () => {
  it("names an outcome that is not a declared state", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const report = reportBundle(root, config, demo!)
    const found = report.findings.filter((f) => f.kind === "unknown-state-outcome")
    expect(found).toEqual([
      expect.objectContaining({
        id: "RULE-demo-invite-resolution",
        detail: expect.stringContaining("STATE-demo-invite-nowhere"),
      }),
    ])
  })

  it("still proves the cross product total", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    const report = reportBundle(root, config, demo!)
    // Four combinations, three rows, `-` covering two of them: no gap here.
    expect(
      report.findings.filter(
        (f) => f.kind === "table-gap" && f.id === "RULE-demo-invite-resolution"
      )
    ).toEqual([])
  })
})

describe("what the board reads off disk", () => {
  it("takes the intent sentence off the assertion, without the ID", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    expect(readStateAssertions(root, config.stateTestsDir, demo!.spec)).toEqual({
      "STATE-demo-roster-empty": "offers the action that fills it",
    })
  })

  it("says nothing rather than guessing when the file is missing", async () => {
    const { config } = await loadConfig(root)
    const [demo] = await loadSpecs(root, config)
    expect(readStateAssertions(root, "e2e/nowhere", demo!.spec)).toEqual({})
  })

  it("collects the states the resolution tables route to", async () => {
    const { config } = await loadConfig(root)
    expect([...readResolvedStates(root, config.specsDir, "demo")].sort()).toEqual([
      "STATE-demo-invite-nowhere",
      "STATE-demo-roster-empty",
      "STATE-demo-roster-populated",
    ])
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

describe("matching an assertion to its state", () => {
  const source = `
test("STATE-demo-roster shows the screen", async ({ page }) => { await go(1) })
test("STATE-demo-roster-empty offers the action that fills it", async ({ page }) => { await go(2) })
`
  it("does not let a state swallow the assertion of one it prefixes", () => {
    // Without a boundary the shorter ID matches both, and its digest would
    // move whenever the longer state's contract moved.
    expect(assertionIntent(source, "STATE-demo-roster")).toBe("shows the screen")
    expect(assertionIntent(source, "STATE-demo-roster-empty")).toBe(
      "offers the action that fills it"
    )
    expect(assertionBlocks(source, "STATE-demo-roster")).toContain("go(1)")
    expect(assertionBlocks(source, "STATE-demo-roster")).not.toContain("go(2)")
  })

  it("says nothing when no test names the state", () => {
    expect(assertionIntent(source, "STATE-demo-nowhere")).toBe(null)
    expect(assertionBlocks(source, "STATE-demo-nowhere")).toBe(null)
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
