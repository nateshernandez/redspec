import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  loadConfig,
  loadSpecs,
  reportBundle,
  unregisteredBundles,
  type BundleReport,
  type Finding,
  type LoadedSpec,
  type SpecConfig,
} from "@redspec/core"

export type Context = {
  root: string
  config: SpecConfig
  configPath: string | null
  specs: LoadedSpec[]
  reports: BundleReport[]
  /** Findings not tied to one bundle. */
  extra: Finding[]
  pkg: Record<string, unknown> | null
}

export async function loadContext(
  root = process.cwd(),
  now = new Date()
): Promise<Context> {
  const { config, path } = await loadConfig(root)
  const specs = await loadSpecs(root, config)
  const reports = specs.map((s) => reportBundle(root, config, s, now))
  const extra = unregisteredBundles(root, config, specs)
  const pkgPath = join(root, "package.json")
  const pkg = existsSync(pkgPath)
    ? (JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>)
    : null
  return { root, config, configPath: path, specs, reports, extra, pkg }
}

export const allFindings = (ctx: Context): Finding[] => [
  ...ctx.reports.flatMap((r) => r.findings),
  ...ctx.extra,
]

/** Which package manager runs scripts here, from the lockfile. */
export function packageManager(root: string): "pnpm" | "yarn" | "bun" | "npm" {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(join(root, "yarn.lock"))) return "yarn"
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock")))
    return "bun"
  return "npm"
}

export const runScript = (pm: string, script: string) =>
  pm === "npm" ? `npm run ${script}` : `${pm} ${script}`
