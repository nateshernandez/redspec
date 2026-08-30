import { spawnSync } from "node:child_process"
import pc from "picocolors"
import { stamp, writeLock } from "@redspec/core"
import { loadContext } from "../context"

export type AcceptOptions = {
  ids?: string[]
  slice?: string
  clarification?: string
  /** Override the configured command. Tests use `true`/`false`. */
  command?: string
  quiet?: boolean
}

/**
 * Re-stamp artifacts -- but only after the verification command passes in this
 * same invocation. This is where all the discipline in the system can leak
 * out, exactly as `--update-snapshots` does elsewhere, so there is no flag that
 * skips the run.
 */
export async function accept(root: string, opts: AcceptOptions): Promise<number> {
  const ctx = await loadContext(root)
  const log = opts.quiet ? () => {} : console.log

  // Resolve which IDs, and which slice owns each.
  const targets: { id: string; slice: string; report: (typeof ctx.reports)[number] }[] =
    []
  if (opts.slice) {
    const report = ctx.reports.find((r) => r.slices.some((s) => s.path === opts.slice))
    const slice = report?.slices.find((s) => s.path === opts.slice)
    if (!report || !slice) {
      console.error(pc.red(`No slice at ${opts.slice}.`))
      return 1
    }
    for (const id of slice.claims) targets.push({ id, slice: slice.path, report })
  }
  for (const id of opts.ids ?? []) {
    const report = ctx.reports.find((r) => id in r.digests)
    if (!report) {
      console.error(
        pc.red(`Nothing digests to "${id}". Is it declared, and spelled as declared?`)
      )
      return 1
    }
    const owners = report.slices.filter((s) => s.claims.includes(id))
    const owner = owners[owners.length - 1]
    if (!owner) {
      console.error(
        pc.red(
          `"${id}" is claimed by no slice. Claim it first (\`redspec new slice\`), or accept via --slice.`
        )
      )
      return 1
    }
    targets.push({ id, slice: owner.path, report })
  }
  if (targets.length === 0) {
    console.error(pc.red("Nothing to accept. Pass IDs or --slice <path>."))
    return 1
  }

  const command = opts.command ?? ctx.config.accept.command
  log(pc.dim(`$ ${command}`))
  const run = spawnSync(command, {
    shell: true,
    stdio: opts.quiet ? "ignore" : "inherit",
    cwd: root,
  })
  if (run.status !== 0) {
    console.error(pc.red(`\nVerification exited ${run.status}. Nothing stamped.`))
    return 1
  }

  const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  })
  const sha = commit.status === 0 ? commit.stdout.trim() : undefined

  const byReport = new Map<string, typeof targets>()
  for (const tg of targets)
    byReport.set(tg.report.slug, [...(byReport.get(tg.report.slug) ?? []), tg])
  for (const [slug, tgs] of byReport) {
    const report = ctx.reports.find((r) => r.slug === slug)!
    let lock = report.lock
    for (const tg of tgs) {
      lock = stamp(lock, [tg.id], report.digests, tg.slice, {
        commit: sha,
        note: opts.clarification,
      })
    }
    writeLock(report.lockPath, lock)
    for (const tg of tgs)
      log(`  ${pc.green("stamped")}  ${tg.id}  ${pc.dim(`← ${tg.slice}`)}`)
  }
  return 0
}
