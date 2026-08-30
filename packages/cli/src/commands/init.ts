import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as p from "@clack/prompts"
import pc from "picocolors"
import {
  defineSpecConfig,
  HARNESSES,
  loadConfig,
  type Framework,
  type Harness,
} from "@redspec/core"
import { CAPABILITIES } from "@redspec/method"
import { packageManager } from "../context"
import { Writer } from "../fs"
import { detectFramework, detectHarnesses, hasTestRunner } from "../harness"
import * as t from "../templates"
import { sync } from "./sync"

export type InitOptions = {
  root: string
  yes?: boolean
  harness?: string
  framework?: Framework
  quiet?: boolean
}

export async function init(opts: InitOptions): Promise<{
  writer: Writer
  install: string[]
  harnesses: Harness[]
  framework: Framework
}> {
  const root = opts.root
  const log = opts.quiet ? () => {} : console.log
  const pkgPath = join(root, "package.json")
  const pkg = existsSync(pkgPath)
    ? (JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>)
    : null
  if (!pkg)
    throw new Error(
      `No package.json in ${root}. Run redspec init at the root of a Node project.`
    )

  const detectedFramework = opts.framework ?? detectFramework(pkg)
  const detectedHarnesses = detectHarnesses(root)
  const runners = hasTestRunner(pkg)
  const pm = packageManager(root)

  let harnesses: Harness[]
  let framework: Framework = detectedFramework
  if (opts.harness !== undefined) {
    harnesses = opts.harness
      .split(",")
      .map((h) => h.trim())
      .filter((h): h is Harness => (HARNESSES as string[]).includes(h))
  } else if (opts.yes) {
    // Re-running init keeps the choice already recorded in spec.config.ts.
    const existing = existsSync(join(root, "spec.config.ts"))
      ? (await loadConfig(root)).config.harnesses
      : null
    harnesses = existing ?? detectedHarnesses.map((d) => d.harness)
  } else {
    p.intro(pc.bgCyan(pc.black(" redspec ")))
    p.note(
      [
        `framework   ${framework === "next" ? pc.green("Next.js") : pc.yellow("none detected — core only, no board")}`,
        `unit tests  ${runners.unit ?? pc.yellow("none — vitest will be added")}`,
        `browser     ${runners.browser ?? pc.yellow("none — @playwright/test will be added")}`,
        "",
        ...HARNESSES.map((h) => {
          const d = detectedHarnesses.find((x) => x.harness === h)
          return `${d ? pc.green("✓") : pc.dim("○")} ${h.padEnd(9)} ${d ? pc.dim(d.evidence) : ""}`
        }),
      ].join("\n"),
      "Detected"
    )
    const picked = await p.multiselect({
      message: "Write agent context for which harnesses?",
      options: HARNESSES.map((h) => ({
        value: h,
        label: h,
        hint: CAPABILITIES[h].hitlOnly
          ? "steps are HITL-only"
          : "steps are conventions; CI is the guardrail",
      })),
      initialValues: detectedHarnesses.map((d) => d.harness),
      required: false,
    })
    if (p.isCancel(picked)) {
      p.cancel("Nothing written.")
      process.exit(1)
    }
    harnesses = picked as Harness[]
    if (framework === "none") {
      const go = await p.confirm({
        message:
          "No supported framework found. Set up core only (specs, rules, lock, coverage — no spec route or board)?",
      })
      if (p.isCancel(go) || !go) {
        p.cancel("Nothing written.")
        process.exit(1)
      }
    }
  }

  const w = new Writer(root)

  // The one config file, and the bundle root.
  w.create("spec.config.ts", t.specConfig(framework, harnesses))
  w.create("specs/index.ts", t.specsIndex)
  w.create("specs/.gitkeep", "")
  w.create("e2e/state/.gitkeep", "")
  w.create("e2e/journey/.gitkeep", "")
  w.create("e2e/screenshot.css", t.screenshotCss)
  if (!runners.browser) w.create("playwright.config.ts", t.playwrightConfig)
  w.create(".github/workflows/redspec.yml", t.ciWorkflow)

  if (framework === "next") {
    const src = existsSync(join(root, "src/app")) ? "src/" : ""
    if (
      existsSync(join(root, `${src}proxy.ts`)) ||
      existsSync(join(root, `${src}middleware.ts`))
    ) {
      w.create(`${src}proxy.redspec.ts`, t.proxy)
      log(
        pc.yellow(
          `  A proxy/middleware already exists. Wrote ${src}proxy.redspec.ts — merge its gate into yours.`
        )
      )
    } else {
      w.create(`${src}proxy.ts`, t.proxy)
    }
    w.create(`${src}app/spec/_routes.ts`, t.nextRoutes)
    w.create(`${src}app/spec/layout.tsx`, t.nextLayout)
    w.create(`${src}app/spec/page.tsx`, t.nextIndex)
    w.create(`${src}app/spec/[feature]/page.tsx`, t.nextBoard)
    w.create(`${src}app/spec/[feature]/[case]/page.tsx`, t.nextCase)
  }

  // package.json scripts, added only where missing.
  const scripts = (pkg.scripts as Record<string, string>) ?? {}
  const add: Record<string, string> = {
    spec: "redspec check",
    "spec:status": "redspec status",
    "test:state": "playwright test --project=state",
    "test:journey": "playwright test --project=journey",
  }
  if (!runners.unit) add.test = "vitest run"
  let changed = false
  for (const [k, v] of Object.entries(add)) {
    if (!scripts[k]) {
      scripts[k] = v
      changed = true
    }
  }
  if (changed) {
    pkg.scripts = scripts
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
    w.written.push({ path: "package.json", action: "updated" })
  }

  // Agent context, per harness.
  const synced = sync(root, defineSpecConfig({ framework, harnesses }), harnesses)
  w.written.push(...synced.written)

  const install = ["@redspec/core", "@redspec/cli"]
  if (framework === "next") install.push("@redspec/next")
  const dev = ["fast-check"]
  if (!runners.unit) dev.push("vitest")
  if (!runners.browser) dev.push("@playwright/test")
  const addCmd = pm === "npm" ? "npm install" : `${pm} add`
  const installLines = [`${addCmd} ${install.join(" ")}`, `${addCmd} -D ${dev.join(" ")}`]

  if (!opts.quiet) {
    for (const f of w.written) {
      if (f.action === "kept") continue
      log(
        `  ${f.action === "created" ? pc.green("create") : pc.cyan("update")}  ${f.path}`
      )
    }
    log("")
    log(pc.bold("Next:"))
    for (const l of installLines) log(`  ${l}`)
    log(`  ${pm === "npm" ? "npx" : `${pm} exec`} redspec doctor`)
    if (harnesses.length) {
      log("")
      for (const h of harnesses) {
        log(`  ${pc.dim(h.padEnd(9))} ${CAPABILITIES[h].note}`)
      }
    }
    log("")
    log(pc.dim("Then: /draft-skeleton <an idea, at whatever resolution you have it>"))
  }

  return { writer: w, install: installLines, harnesses, framework }
}
