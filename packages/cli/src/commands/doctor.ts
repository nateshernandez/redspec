import { existsSync } from "node:fs"
import { join } from "node:path"
import pc from "picocolors"
import { DIGEST_ALGO, HARNESSES } from "@redspec/core"
import { CAPABILITIES } from "@redspec/method"
import { loadContext } from "../context"
import { detectHarnesses } from "../harness"
import { staleContexts } from "./sync"

export async function doctor(root: string): Promise<number> {
  let problems = 0
  const ok = (s: string) => console.log(`  ${pc.green("✓")} ${s}`)
  const warn = (s: string) => console.log(`  ${pc.yellow("!")} ${s}`)
  const bad = (s: string) => {
    problems++
    console.log(`  ${pc.red("✗")} ${s}`)
  }

  let ctx
  try {
    ctx = await loadContext(root)
  } catch (e) {
    bad(`Specs failed to load: ${(e as Error).message}`)
    return 1
  }
  console.log(pc.bold("Config"))
  ctx.configPath
    ? ok(
        `spec.config.ts (framework: ${ctx.config.framework}, route: ${ctx.config.route})`
      )
    : bad("No spec.config.ts. Run `redspec init`.")
  ok(
    `${ctx.specs.length} feature${ctx.specs.length === 1 ? "" : "s"} load${ctx.specs.length === 1 ? "s" : ""}`
  )
  for (const r of ctx.reports) {
    if (r.lock.algo !== 0 && r.lock.algo !== DIGEST_ALGO)
      bad(
        `${r.slug}: lock algo ${r.lock.algo}, this redspec writes ${DIGEST_ALGO}. Run \`redspec accept\` over its claims after upgrading.`
      )
  }
  for (const f of ctx.extra) warn(`${f.id}: ${f.detail}`)

  if (ctx.config.framework === "next") {
    console.log(pc.bold("\nNext.js"))
    const src = existsSync(join(root, "src/app")) ? "src/" : ""
    const has = (p: string) => existsSync(join(root, src + p))
    has("proxy.ts") || has("proxy.redspec.ts")
      ? ok("proxy.ts gates the spec route in production")
      : bad("No proxy.ts. The spec route will serve in production.")
    has("app/spec/_routes.ts")
      ? ok("app/spec/ routes present")
      : bad("app/spec/_routes.ts missing.")
    existsSync(join(root, ctx.config.specsDir, "index.ts"))
      ? ok(`${ctx.config.specsDir}/index.ts registers features for the app`)
      : bad(`${ctx.config.specsDir}/index.ts missing.`)
  }

  console.log(pc.bold("\nHarnesses"))
  const detected = new Set(detectHarnesses(root).map((d) => d.harness))
  for (const h of HARNESSES) {
    const configured = ctx.config.harnesses.includes(h)
    const cap = CAPABILITIES[h]
    const mark = configured
      ? pc.green("✓")
      : detected.has(h)
        ? pc.yellow("!")
        : pc.dim("○")
    const label = configured
      ? "configured"
      : detected.has(h)
        ? "detected, not configured — add to spec.config.ts harnesses and `redspec sync`"
        : ""
    console.log(`  ${mark} ${h.padEnd(9)} ${pc.dim(label)}`)
    if (configured) {
      console.log(
        `      ${cap.hitlOnly ? pc.green("steps are HITL-only") : pc.yellow("steps are conventions, not gates")} · ${cap.subagents ? "adversary/verifier run as subagents" : "adversary/verifier run as fresh tasks"}`
      )
      console.log(pc.dim(`      ${cap.note}`))
    }
  }
  const stale = staleContexts(root, ctx.config)
  if (stale.length) {
    warn(
      `${stale.length} rendered context file${stale.length === 1 ? " is" : "s are"} stale (redspec upgraded, or config changed). Run \`redspec sync\`.`
    )
    for (const s of stale) console.log(pc.dim(`      ${s}`))
  } else if (ctx.config.harnesses.length)
    ok("rendered contexts match this redspec version")

  console.log("")
  console.log(
    problems
      ? pc.red(`${problems} problem${problems === 1 ? "" : "s"}.`)
      : pc.green("Healthy.")
  )
  return problems ? 1 : 0
}
