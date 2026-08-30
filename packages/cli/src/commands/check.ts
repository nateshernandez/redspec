import pc from "picocolors"
import { allFindings, loadContext } from "../context"
import { printCheck } from "../print"

export async function check(
  root: string,
  opts: { json?: boolean; quiet?: boolean } = {}
): Promise<number> {
  const ctx = await loadContext(root)
  const findings = allFindings(ctx)
  if (opts.json) {
    console.log(
      JSON.stringify({ findings, specs: ctx.specs.map((s) => s.spec.slug) }, null, 2)
    )
    return findings.length ? 1 : 0
  }
  if (findings.length === 0) {
    if (!opts.quiet)
      console.log(
        pc.green(
          `redspec: clean. ${ctx.specs.length} spec${ctx.specs.length === 1 ? "" : "s"}, ${ctx.reports.reduce((n, r) => n + r.artifacts.length, 0)} artifacts.`
        )
      )
    return 0
  }
  if (!opts.quiet) printCheck(findings)
  console.log("")
  console.log(
    pc.red(`${findings.length} finding${findings.length === 1 ? "" : "s"}. Exit 1.`) +
      pc.dim("  redspec status for the grouped view.")
  )
  return 1
}
