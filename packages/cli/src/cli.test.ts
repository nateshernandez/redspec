import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { accept } from "./commands/accept"
import { check } from "./commands/check"
import { init } from "./commands/init"
import { newFeature, newJourneys, newRule, newSlice, newState } from "./commands/new"
import { staleContexts, sync } from "./commands/sync"
import { loadContext } from "./context"
import { detectFramework, detectHarnesses } from "./harness"
import { installCommand, missingDeps } from "./install"

// A fresh fake Next app with Claude Code and Cursor already in it.
let root: string
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "redspec-"))
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "app",
        private: true,
        type: "module",
        scripts: { dev: "next dev", test: "vitest run" },
        dependencies: { next: "16.2.6", react: "19.2.4" },
        devDependencies: { vitest: "^4" },
      },
      null,
      2
    )
  )
  writeFileSync(join(root, "pnpm-lock.yaml"), "")
  mkdirSync(join(root, ".claude"))
  mkdirSync(join(root, ".cursor/rules"), { recursive: true })
  writeFileSync(join(root, "CLAUDE.md"), "# My app\n\nKeep this line.\n")
  mkdirSync(join(root, "app"))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe("detection", () => {
  it("sees the harnesses and the framework already in the repo", () => {
    expect(detectHarnesses(root, {}).map((d) => d.harness)).toEqual(["claude", "cursor"])
    expect(
      detectFramework(JSON.parse(readFileSync(join(root, "package.json"), "utf8")))
    ).toBe("next")
  })
})

describe("init on a Next app", () => {
  it("writes the config, the gate, the route re-exports, and per-harness context", async () => {
    const r = await init({ root, yes: true, quiet: true, skipInstall: true })
    expect(r.framework).toBe("next")
    expect(r.harnesses).toEqual(["claude", "cursor"])
    for (const f of [
      "spec.config.ts",
      "proxy.ts",
      "app/spec/_routes.ts",
      "app/spec/layout.tsx",
      "app/spec/page.tsx",
      "app/spec/[feature]/page.tsx",
      "app/spec/[feature]/[case]/page.tsx",
      "specs/index.ts",
      "playwright.config.ts",
      "e2e/screenshot.css",
      ".github/workflows/redspec.yml",
      "docs/agents/redspec.md",
      "docs/humans/redspec.md",
      ".claude/skills/draft-skeleton/SKILL.md",
      ".claude/agents/spec-adversary.md",
      ".cursor/rules/redspec.mdc",
      ".cursor/rules/redspec-amend.mdc",
      ".redspec/contexts.json",
    ]) {
      expect(existsSync(join(root, f)), f).toBe(true)
    }
    expect(existsSync(join(root, "AGENTS.md"))).toBe(true) // Cursor reads it
    expect(existsSync(join(root, "GEMINI.md"))).toBe(false)
    expect(r.install[0]).toContain("@redspec/next")
  })
  it("merges a section into CLAUDE.md and leaves the owner's text alone", () => {
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf8")
    expect(claude).toContain("Keep this line.")
    expect(claude).toContain("<!-- redspec:start -->")
    expect(claude).toContain("docs/agents/redspec.md")
  })
  it("adds scripts without clobbering existing ones", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    expect(pkg.scripts.test).toBe("vitest run")
    expect(pkg.scripts.spec).toBe("redspec check")
    expect(pkg.scripts["test:state"]).toBe("playwright test --project=state")
  })
  it("is idempotent", async () => {
    const before = readFileSync(join(root, "CLAUDE.md"), "utf8")
    await init({ root, yes: true, quiet: true, skipInstall: true })
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe(before)
    expect(
      readFileSync(join(root, "CLAUDE.md"), "utf8").match(/redspec:start/g)
    ).toHaveLength(1)
  })
  it("passes check with no specs yet", async () => {
    expect(await check(root, { quiet: true })).toBe(0)
  })
})

describe("dependencies", () => {
  it("counts only what the repo does not already have", () => {
    mkdirSync(join(root, "node_modules/@redspec/core"), { recursive: true })
    expect(missingDeps(root, ["@redspec/core", "@redspec/next"])).toEqual([
      "@redspec/next",
    ])
  })

  it("pins exact versions, and puts dev deps where the manager expects them", () => {
    expect(installCommand("pnpm", ["vitest"], true)).toBe(
      "pnpm add --save-exact --save-dev vitest"
    )
    expect(installCommand("npm", ["@redspec/core"], false)).toBe(
      "npm install --save-exact --save @redspec/core"
    )
    expect(installCommand("yarn", ["vitest"], true)).toBe("yarn add --exact --dev vitest")
  })

  it("skipInstall still reports the lines it did not run", async () => {
    const r = await init({ root, yes: true, quiet: true, skipInstall: true })
    expect(r.install.join(" ")).toContain("fast-check")
  })
})

describe("scaffolding a feature", () => {
  it("creates the bundle and registers it with the app", async () => {
    // The scaffold imports @redspec/core; point the fake app at this workspace's
    // source through a shim package, so the test needs no build.
    const shim = join(root, "node_modules/@redspec/core")
    mkdirSync(shim, { recursive: true })
    writeFileSync(
      join(shim, "package.json"),
      JSON.stringify({ name: "@redspec/core", type: "module", exports: "./index.ts" })
    )
    writeFileSync(
      join(shim, "index.ts"),
      `export * from ${JSON.stringify(join(import.meta.dirname, "../../core/src/index.ts"))}\n`
    )
    expect(await newFeature(root, "roster-invites", true)).toBe(0)
    for (const f of [
      "specs/roster-invites/BRIEF.md",
      "specs/roster-invites/spec.ts",
      "specs/roster-invites/copy.ts",
      "specs/roster-invites/fixtures.ts",
      "specs/roster-invites/sketches.tsx",
      "e2e/state/roster-invites.spec.ts",
      "e2e/journey/roster-invites.spec.ts",
    ]) {
      expect(existsSync(join(root, f)), f).toBe(true)
    }
    const index = readFileSync(join(root, "specs/index.ts"), "utf8")
    expect(index).toContain('import rosterInvitesSpec from "./roster-invites/spec"')
    expect(index).toContain("  rosterInvitesSpec,\n  // redspec:specs")
  })

  it("loads the skeleton, and check is red on a declared state", async () => {
    // Declare one surface and a flow the way /draft-skeleton would.
    const specPath = join(root, "specs/roster-invites/spec.ts")
    writeFileSync(
      specPath,
      `import { defineSpec } from "@redspec/core"
export default defineSpec({
  slug: "roster-invites", title: "Roster",
  surfaces: { roster: { title: "Roster", checklist: {
    empty: { state: "STATE-roster-invites-roster-empty" }, loading: { waived: "x" }, partial: { waived: "x" },
    populated: { state: "STATE-roster-invites-roster-populated" }, overflowing: { waived: "x" }, recoverableError: { waived: "x" },
    terminalError: { waived: "x" }, permissionDenied: { waived: "x" }, stale: { waived: "x" }, inFlight: { waived: "x" },
    terminalSuccess: { waived: "x" }, conflict: { waived: "x" } } } },
  cases: {},
  flows: [{ id: "JOURNEY-roster-invites-view", title: "View", actor: "Someone",
    spine: [{ case: "STATE-roster-invites-roster-empty", on: "Invites" }, { case: "STATE-roster-invites-roster-populated", end: "Done." }],
    deviations: [{ from: "STATE-roster-invites-roster-empty", when: "Offline", case: "STATE-roster-invites-roster-empty", end: "Waits." }] }],
})
`
    )
    const ctx = await loadContext(root)
    expect(ctx.specs.map((s) => s.spec.slug)).toEqual(["roster-invites"])
    const kinds = ctx.reports[0]!.findings.map((f) => f.kind)
    expect(kinds).toContain("declared-not-rendered")
    expect(kinds).toContain("orphan")
    expect(await check(root, { quiet: true })).toBe(1)
  })

  it("scaffolds a state, a rule, a slice, and generated journeys", async () => {
    expect(
      await newState(root, "STATE-roster-invites-roster-empty", { quiet: true })
    ).toBe(0)
    expect(
      readFileSync(join(root, "specs/roster-invites/sketches.tsx"), "utf8")
    ).toContain("export function RosterEmpty()")
    expect(
      readFileSync(join(root, "e2e/state/roster-invites.spec.ts"), "utf8")
    ).toContain('test("STATE-roster-invites-roster-empty')

    expect(
      await newRule(root, "RULE-roster-invites-cooldown", { form: "table", quiet: true })
    ).toBe(0)
    expect(
      existsSync(join(root, "specs/roster-invites/rules/RULE-roster-invites-cooldown.md"))
    ).toBe(true)
    expect(
      existsSync(
        join(root, "specs/roster-invites/rules/RULE-roster-invites-cooldown.test.ts")
      )
    ).toBe(true)

    expect(
      await newSlice(root, "roster-invites", "01-roster", {
        claims: [
          "STATE-roster-invites-roster-empty",
          "STATE-roster-invites-roster-populated",
          "JOURNEY-roster-invites-view",
          "RULE-roster-invites-cooldown",
          // The screen's twelve answers, waiver reasons included, are claimed
          // like anything else -- otherwise softening one moves a requirement
          // with nothing to notice.
          "SURFACE-roster-invites-roster",
        ],
        amends: [],
        quiet: true,
      })
    ).toBe(0)
    expect(
      await newSlice(root, "roster-invites", "A02-cooldown", {
        claims: ["RULE-roster-invites-cooldown"],
        amends: ["RULE-roster-invites-cooldown"],
        quiet: true,
      })
    ).toBe(0)
    expect(
      readFileSync(join(root, "specs/roster-invites/slices/A02-cooldown.md"), "utf8")
    ).toContain("**Amends:**")

    expect(await newJourneys(root, "roster-invites", true)).toBe(0)
    const journeys = readFileSync(
      join(root, "e2e/journey/roster-invites.spec.ts"),
      "utf8"
    )
    expect(journeys).toContain('test.fixme("JOURNEY-roster-invites-view [path 1]')
    expect(journeys).toContain("[path 2]")

    // The table template is total, so no table findings; the amendment slice is not a double claim.
    const ctx = await loadContext(root)
    const kinds = ctx.reports[0]!.findings.map((f) => f.kind)
    expect(kinds).not.toContain("table-gap")
    expect(kinds).not.toContain("claimed-twice")
    expect(kinds).not.toContain("orphan")
  })
})

describe("accept", () => {
  it("refuses to stamp when verification fails, and stamps when it passes", async () => {
    expect(
      await accept(root, {
        ids: ["RULE-roster-invites-cooldown"],
        command: "exit 1",
        quiet: true,
      })
    ).toBe(1)
    expect(existsSync(join(root, "specs/roster-invites/.spec-lock.json"))).toBe(false)

    expect(
      await accept(root, {
        slice: "specs/roster-invites/slices/01-roster.md",
        command: "exit 0",
        quiet: true,
      })
    ).toBe(0)
    const lock = JSON.parse(
      readFileSync(join(root, "specs/roster-invites/.spec-lock.json"), "utf8")
    )
    expect(Object.keys(lock.entries).sort()).toEqual([
      "JOURNEY-roster-invites-view",
      "RULE-roster-invites-cooldown",
      "STATE-roster-invites-roster-empty",
      "STATE-roster-invites-roster-populated",
      "SURFACE-roster-invites-roster",
    ])
    expect(lock.entries["RULE-roster-invites-cooldown"].slice).toBe(
      "specs/roster-invites/slices/01-roster.md"
    )
  })

  it("reports the artifact as amended once its content moves, and clears after a clarification", async () => {
    const rule = join(root, "specs/roster-invites/rules/RULE-roster-invites-cooldown.md")
    writeFileSync(
      rule,
      readFileSync(rule, "utf8").replace(
        "(100..]  | free | blocked",
        "(100..]  | free | allowed"
      )
    )
    let ctx = await loadContext(root)
    expect(ctx.reports[0]!.findings).toContainEqual(
      expect.objectContaining({ kind: "amended", id: "RULE-roster-invites-cooldown" })
    )

    expect(
      await accept(root, {
        ids: ["RULE-roster-invites-cooldown"],
        command: "exit 0",
        clarification: "wording",
        quiet: true,
      })
    ).toBe(0)
    ctx = await loadContext(root)
    expect(ctx.reports[0]!.findings.map((f) => f.kind)).not.toContain("amended")
    const lock = JSON.parse(
      readFileSync(join(root, "specs/roster-invites/.spec-lock.json"), "utf8")
    )
    // The amendment slice is the latest claimant, so it owns the re-stamp.
    expect(lock.entries["RULE-roster-invites-cooldown"].slice).toBe(
      "specs/roster-invites/slices/A02-cooldown.md"
    )
    expect(lock.entries["RULE-roster-invites-cooldown"].note).toBe("wording")
  })

  it("reports a softened waiver as amended", async () => {
    // The waiver is the only prose left in a bundle, and it is a claim about
    // the product rather than about the code. Weakening one is a requirement
    // moving, so it has to reach the same sign-off the original did.
    const specPath = join(root, "specs/roster-invites/spec.ts")
    const before = readFileSync(specPath, "utf8")
    writeFileSync(
      specPath,
      before.replace('stale: { waived: "x" }', 'stale: { waived: "usually x" }')
    )
    const ctx = await loadContext(root)
    expect(ctx.reports[0]!.findings).toContainEqual(
      expect.objectContaining({ kind: "amended", id: "SURFACE-roster-invites-roster" })
    )
    writeFileSync(specPath, before)
  })
})

describe("sync", () => {
  it("knows when rendered contexts are stale", async () => {
    const ctx = await loadContext(root)
    expect(staleContexts(root, ctx.config)).toEqual([])
    writeFileSync(
      join(root, ".redspec/contexts.json"),
      JSON.stringify({ version: 1, files: { "docs/agents/redspec.md": "sha256:0000" } })
    )
    expect(staleContexts(root, ctx.config)).toContain("docs/agents/redspec.md")
    sync(root, ctx.config)
    expect(staleContexts(root, ctx.config)).toEqual([])
  })
})
