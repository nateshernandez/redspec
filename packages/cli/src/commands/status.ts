import { loadContext } from "../context"
import { printStatus } from "../print"

export async function status(root: string, opts: { ids?: string } = {}): Promise<number> {
  const ctx = await loadContext(root)
  if (opts.ids !== undefined) {
    const reports = opts.ids
      ? ctx.reports.filter((r) => r.slug === opts.ids)
      : ctx.reports
    for (const r of reports) for (const a of r.artifacts) console.log(a.id)
    return 0
  }
  printStatus(ctx)
  return 0
}
