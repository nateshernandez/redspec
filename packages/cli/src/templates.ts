// Everything `redspec init` and `redspec new` write. Inline so the CLI bundles
// to one file and a template cannot drift from the code that fills it.

export const specConfig = (
  framework: string,
  harnesses: string[]
) => `import { defineSpecConfig } from "@redspec/core"

export default defineSpecConfig({
  framework: "${framework}",
  route: "/spec",
  caseViewport: { width: 1280, height: 720 },
  // "witnessed" makes every waiver name the INV- that would go red if it stopped holding.
  waivers: "free",
  // Must exit 0 in the same invocation for \`redspec accept\` to stamp anything.
  accept: { command: "pnpm test && pnpm test:state" },
  // Which agent harnesses \`redspec sync\` writes context for.
  harnesses: ${JSON.stringify(harnesses)},
})
`

export const proxy = `import { createSpecProxy, specProxyMatcher } from "@redspec/next/gate"

// The production gate. It answers 404 before anything renders: a layout-level
// notFound() still serializes the page into the response body.
export const proxy = createSpecProxy({ route: "/spec" })
export const config = { matcher: specProxyMatcher("/spec") }
`

export const specsIndex = `// Every feature this repo declares. \`redspec new feature\` appends here.
import type { Spec } from "@redspec/core"

// redspec:imports

export const specs: Spec[] = [
  // redspec:specs
]
`

export const nextRoutes = `import { createSpecRoutes } from "@redspec/next"
import { specs } from "../../specs"

export const { SpecLayout, SpecIndexPage, SpecBoardPage, SpecCasePage, generateStaticParams } =
  createSpecRoutes(specs, { route: "/spec" })
`
export const nextLayout = `export { SpecLayout as default } from "./_routes"\n`
export const nextIndex = `export { SpecIndexPage as default } from "./_routes"\n`
export const nextBoard = `export { SpecBoardPage as default, generateStaticParams } from "../_routes"\n`
export const nextCase = `export { SpecCasePage as default } from "../../_routes"\n`

export const playwrightConfig = `import { defineConfig, devices } from "@playwright/test"

// Two tiers, differing by target rather than by tool. \`state\` points at the
// spec route -- fixtures only, no auth, no backend -- and asserts exhaustively.
// \`journey\` points at the real app and stays a handful of paths. Both run
// against the dev server: the spec route 404s in production by design.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { toHaveScreenshot: { stylePath: "./e2e/screenshot.css" } },
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "state", testDir: "./e2e/state", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "journey", testDir: "./e2e/journey", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
})
`

export const screenshotCss = `/* Injected into every screenshot. The Next dev-tools indicator changes with the
 * dev server's state, so it stays out of frame. */
nextjs-portal { display: none !important; }
`

export const ciWorkflow = `name: redspec
on:
  pull_request:
  push:
    branches: [main]
jobs:
  spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # The gate. Red on a skeleton is correct; red on main is a stop.
      - run: pnpm exec redspec check
      - run: pnpm test
`

// ---- feature bundle ----

export const brief = (slug: string, title: string) => `# ${title}

## Problem

What is wrong today, from the perspective of the person it is wrong for. Two or three sentences.

## Actors

- **Someone**: what they want from this. One bolded bullet per actor; the audit reads this list and fails on an actor with no flow.

## What changes

The shortest honest statement of the new capability.

## Non-goals

- **Something a reader would assume is included.** Why it is not.

## Deliberate unknowns

- **A question knowingly left open.** What happens if the guess is wrong, and how expensive that is.
`

export const specTs = (
  slug: string,
  title: string
) => `import { defineSpec } from "@redspec/core"
import { copy } from "./copy"
import * as fixtures from "./fixtures"
import * as sketches from "./sketches"

// \`redspec status\` is the work list. After /draft-skeleton, \`surfaces\` and
// \`flows\` are filled and \`cases\` is empty: every declared state is a stub on
// the board and a red line in status. /render-states fills \`cases\`.
export default defineSpec({
  slug: "${slug}",
  title: "${title}",

  surfaces: {
    // <key>: {
    //   title: "The screen",
    //   checklist: {
    //     empty: { state: "STATE-${slug}-<key>-empty" },
    //     loading: { state: "STATE-${slug}-<key>-loading" },
    //     partial: { waived: "Why this screen cannot be half-loaded.", witness: "INV-…" },
    //     populated: { state: "STATE-${slug}-<key>-populated" },
    //     overflowing: { state: "STATE-${slug}-<key>-overflowing" },
    //     recoverableError: { state: "STATE-${slug}-<key>-retry" },
    //     terminalError: { state: "STATE-${slug}-<key>-failed" },
    //     permissionDenied: { state: "STATE-${slug}-<key>-read-only" },
    //     stale: { waived: "Reads are live.", review: "2027-01-01" },
    //     inFlight: { state: "STATE-${slug}-<key>-saving" },
    //     terminalSuccess: { waived: "A place, not a flow that finishes." },
    //     conflict: { state: "STATE-${slug}-<key>-conflict" },
    //   },
    // },
  },

  cases: {},

  flows: [
    // {
    //   id: "JOURNEY-${slug}-<intent>",
    //   title: "What the actor gets",
    //   actor: "Someone",            // must match a bolded actor in BRIEF.md
    //   spine: [
    //     { case: "STATE-${slug}-<key>-empty", on: "Does the first thing" },
    //     { case: "STATE-${slug}-<key>-populated", end: "What they are left with." },
    //   ],
    //   deviations: [
    //     { from: "STATE-${slug}-<key>-populated", when: "Cold cache", case: "STATE-${slug}-<key>-loading", rejoins: "STATE-${slug}-<key>-populated" },
    //   ],
    // },
  ],
})

// Keep the imports live so the skeleton typechecks before any case uses them.
void copy
void fixtures
void sketches
`

export const copyTs = (slug: string) => `import { defineCopy } from "@redspec/core"

// Every user-facing string this feature ships, once. Sketches render from it;
// assertions assert against it. A word changes here and both readers see it.
export const copy = defineCopy({
  // "COPY-${slug}-<key>-empty-title": "Nothing here yet",
})
`

export const fixturesTs =
  () => `// Fixtures for the cases. Plain data, no network, no database: a case that
// reaches for either is a Journey wearing a State's clothes.
export {}
`

export const sketchesTsx =
  () => `// Sketch markup for the cases. Drafts: a slice promotes them into components/
// and the assertions survive unchanged, which is why those are written in
// user intent rather than against a selector.
export {}
`

export const stateSpec = (
  slug: string
) => `import { expect, test } from "@playwright/test"
import { copy } from "../../specs/${slug}/copy"

// One behavioural assertion and one screenshot per state, named for its ID,
// written in user intent. \`redspec new state <ID>\` appends here.
void copy
void expect
void test
`

export const journeySpecHeader = (
  slug: string
) => `import { test } from "@playwright/test"

// Generated by \`redspec new journeys ${slug}\` from the flows in spec.ts — one
// per reachable path. Regenerate rather than edit. Each stays fixme until the
// slice that claims its JOURNEY- lands and un-fixmes it.
`

export const journeyTest = (
  id: string,
  index: number,
  states: string[],
  labels: string[],
  end: string
) => {
  const steps = states
    .map((s, i) => (labels[i] ? `  // ${s}\n  //   → ${labels[i]}` : `  // ${s}`))
    .join("\n")
  return `
test.fixme("${id} [path ${index + 1}]: ${end.replace(/"/g, '\\"')}", async ({ page }) => {
${steps}
  // Ends: ${end}
  await page.goto("/")
})
`
}

export const stateFixture = (id: string) => `
// ${id}
export const ${camel(id)} = {}
`
export const stateSketch = (id: string, component: string) => `
// ${id}
export function ${component}() {
  return <div>{/* ${id} */}</div>
}
`
export const stateAssertion = (id: string) => `
test("${id} <what a reviewer would say out loud about it>", async ({ page }) => {
  await page.goto("/spec/<slug>/${id}")
  // await expect(page.getByText(copy["COPY-…"])).toBeVisible()
  await expect(page).toHaveScreenshot("${id}.png")
})
`
export const caseSnippet = (
  id: string,
  surface: string,
  component: string,
  fixture: string
) =>
  `    "${id}": {\n      title: "<what this state is>",\n      surface: "${surface}",\n      render: () => <sketches.${component} {...fixtures.${fixture}} />,\n    },`

export function camel(id: string): string {
  return id
    .replace(/^(STATE|RULE|INV|JOURNEY|COPY)-/, "")
    .split("-")
    .map((p, i) => (i === 0 ? p : p[0]!.toUpperCase() + p.slice(1)))
    .join("")
}
export function pascal(id: string): string {
  const c = camel(id)
  return c[0]!.toUpperCase() + c.slice(1)
}

export const ruleStub = (id: string) => `# ${id}

What this rule decides, in one sentence.

| Input | Output | Why |
| --- | --- | --- |
| the figure the person gave | in their words | their reason |

**Status:** stub. /implement-rules picks the rung.
`
export const ruleTable = (id: string) => `## ${id}

What this rule decides, in one sentence.

**Inputs:** amount: number(0..), plan: {free, pro}
**Hit policy:** UNIQUE

| amount   | plan | outcome | note |
| -------- | ---- | ------- | ---- |
| [0..100] | -    | allowed | under the limit |
| (100..]  | free | blocked | free plans stop at 100 |
| (100..]  | pro  | allowed | pro plans have no limit |

<!-- \`redspec check\` proves this total and non-overlapping. Drive it from a test with
     parseDecisionTable + decide + representativeInputs from @redspec/core. -->
`
export const ruleTableTest = (id: string) => `import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { decide, parseDecisionTable, representativeInputs } from "@redspec/core"

// ${id}: the markdown table is the artifact a reviewer signs; this is plumbing.
const table = parseDecisionTable(readFileSync(join(import.meta.dirname, "${id}.md"), "utf8"))

// Replace with the real implementation under test.
const implementation = (input: Record<string, number | string | boolean>) => decide(table, input)

describe("${id}", () => {
  it("agrees with the table in every region it distinguishes", () => {
    for (const input of representativeInputs(table)) {
      expect(implementation(input)).toEqual(decide(table, input))
    }
  })
})
`
export const ruleMachine = (id: string) => `// ${id}
//
// A lifecycle as an explicit states × events table. The empty cells are the
// point: an undefined transition is visible by inspection.

export type State = "draft" | "submitted" | "approved"
export type Event = "submit" | "approve" | "reject"

export const machine = {
  draft: { submit: "submitted" },
  submitted: { approve: "approved", reject: "draft" },
  approved: {},
} as const satisfies Record<State, Partial<Record<Event, State>>>

export function next(state: State, event: Event): State | null {
  return (machine[state] as Partial<Record<Event, State>>)[event] ?? null
}
`
export const ruleMachineTest = (id: string) => `import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { machine, next, type Event, type State } from "./${id}"

// ${id}: two tests. The shape test proves the table is well-formed; the
// model-based run proves the implementation *is* the table.
describe("${id}", () => {
  it("names every state", () => {
    const states: State[] = ["draft", "submitted", "approved"]
    for (const s of states) expect(machine).toHaveProperty(s)
  })

  it("the implementation tracks the table across random legal event sequences", () => {
    const events: Event[] = ["submit", "approve", "reject"]
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...events), { maxLength: 20 }), (seq) => {
        let model: State = "draft"
        // Replace \`sut\` with the real system under test and step it alongside the model.
        let sut: State = "draft"
        for (const e of seq) {
          const to = next(model, e)
          if (to === null) continue // illegal in the model: the SUT must refuse it too
          model = to
          sut = to
          expect(sut).toBe(model)
        }
      })
    )
  })
})
`
export const ruleInvariant = (id: string) => `import fc from "fast-check"
import { describe, expect, it } from "vitest"

// ${id}: a sentence about the domain that admits no exception.
describe("${id}", () => {
  it("holds for every input", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(n + 0).toBe(n) // replace with the property
      })
    )
  })
})
`
export const ruleType = (id: string) => `// ${id}
//
// Make the illegal state unrepresentable and the rule needs no test.
export type Example =
  | { status: "draft" }
  | { status: "sent"; sentAt: Date }
`

export const slice = (title: string, claims: string[], amends: string[]) => `# ${title}

**Delivers:** the end-to-end behaviour this makes work, from the user's perspective.

**Blocked by:** None.
${amends.length ? `\n**Amends:**\n\n${amends.map((a) => `- \`${a}\``).join("\n")}\n\n**Because:** why the requirement moved.\n` : ""}
**Claims:**

${claims.map((c) => `- \`${c}\``).join("\n") || "- `STATE-…`"}

**Status:** ready
`
