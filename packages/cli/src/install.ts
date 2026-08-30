import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import pc from "picocolors"

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm"

/**
 * Which of `deps` this repo does not already have. `init` installs only these,
 * so a package already present -- a workspace link, a local tarball, a version
 * the repo pins on purpose -- is never re-fetched or overwritten.
 */
export function missingDeps(root: string, deps: string[]): string[] {
  return deps.filter((d) => !existsSync(join(root, "node_modules", d)))
}

function installArgs(
  pm: PackageManager,
  deps: string[],
  dev: boolean
): [string, ...string[]] {
  if (pm === "npm")
    return ["npm", "install", "--save-exact", dev ? "--save-dev" : "--save", ...deps]
  if (pm === "yarn") return ["yarn", "add", "--exact", ...(dev ? ["--dev"] : []), ...deps]
  if (pm === "bun") return ["bun", "add", "--exact", ...(dev ? ["--dev"] : []), ...deps]
  return ["pnpm", "add", "--save-exact", dev ? "--save-dev" : "--save-prod", ...deps]
}

/** The install line as a person would type it, for when we cannot run it. */
export const installCommand = (pm: PackageManager, deps: string[], dev: boolean) =>
  installArgs(pm, deps, dev).join(" ")

/**
 * Install `deps`, naming them first -- a scaffolder that mutates a lockfile in
 * silence is worse than one that asks. Returns false if the manager exited
 * non-zero, so the caller can fall back to printing the command.
 */
export function installDeps(
  root: string,
  pm: PackageManager,
  deps: string[],
  dev: boolean,
  log: (s: string) => void
): boolean {
  if (!deps.length) return true
  log("")
  log(`Installing ${dev ? "devDependencies" : "dependencies"} (${pm}):`)
  for (const d of deps) log(`  ${pc.cyan(d)}`)
  const [cmd, ...args] = installArgs(pm, deps, dev)
  const run = spawnSync(cmd, args, { cwd: root, stdio: "inherit" })
  return run.status === 0
}
