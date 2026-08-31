import pc from "picocolors"
import { flowCoverage, type Finding, type FindingKind } from "@redspec/core"
import type { Context } from "./context"

type Group = {
  title: string
  kinds: FindingKind[]
  hint: string
  tone: (s: string) => string
}

const GROUPS: Group[] = [
  {
    title: "UNNAMED — declared with only an ID",
    kinds: ["unnamed-state"],
    hint: "→ say what the person is looking at",
    tone: pc.yellow,
  },
  {
    title: "DECLARED — not yet rendered",
    kinds: ["declared-not-rendered"],
    hint: "→ /render-states",
    tone: pc.yellow,
  },
  {
    title: "AMENDED — changed since it was verified",
    kinds: ["amended", "unverified"],
    hint: "→ /amend, or redspec accept",
    tone: pc.magenta,
  },
  {
    title: "WAIVERS",
    kinds: ["waiver-due", "waiver-unwitnessed", "unknown-witness"],
    hint: "→ re-read it: believe it, or build the state",
    tone: pc.cyan,
  },
  {
    title: "DECISION TABLES",
    kinds: ["table-gap", "table-overlap", "table-parse", "unknown-state-outcome"],
    hint: "→ make the table total",
    tone: pc.red,
  },
  {
    title: "SHAPE",
    kinds: [
      "off-path",
      "off-checklist",
      "unclaimed-id",
      "unknown-surface",
      "surface-mismatch",
      "dangling-deviation",
      "deviation-off-deviation",
      "compound-actor",
      "spine-ends-early",
      "empty-spine",
      "bad-id",
    ],
    hint: "→ the registry disagrees with itself",
    tone: pc.red,
  },
  {
    title: "BUNDLE",
    kinds: [
      "actor-without-flow",
      "missing-brief",
      "unregistered-feature",
      "unknown-copy",
    ],
    hint: "→ the bundle on disk disagrees with the registry",
    tone: pc.red,
  },
  {
    title: "COVERAGE",
    kinds: ["orphan", "claimless", "unknown-id", "claimed-twice"],
    hint: "→ /cut-slices",
    tone: pc.red,
  },
]

export function printStatus(
  ctx: Context,
  write: (s: string) => void = console.log
): void {
  if (ctx.specs.length === 0 && ctx.extra.length === 0) {
    write(pc.dim("No specs yet. Run /draft-skeleton, or `redspec new feature <slug>`."))
    return
  }
  for (const report of ctx.reports) {
    const spec = ctx.specs.find((s) => s.spec.slug === report.slug)!.spec
    const declared = report.artifacts.filter((a) => a.kind === "STATE").length
    const rendered = Object.keys(spec.cases).length
    write(
      `${pc.bold(report.slug)}${" ".repeat(Math.max(1, 50 - report.slug.length))}${pc.dim(`${rendered} of ${declared} states rendered`)}`
    )
    printGroups(report.findings, write)
    const cov = flowCoverage(spec, ctx.config.journeyBudget)
    const paths = cov.reduce((n, c) => n + c.reachablePaths, 0)
    const stamped = Object.keys(report.lock.entries).length
    const line = [
      `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`,
      `${cov.length} flow${cov.length === 1 ? "" : "s"} · ${paths} reachable path${paths === 1 ? "" : "s"}${cov.some((c) => c.truncated) ? " (truncated)" : ""}`,
      `${stamped} of ${report.artifacts.length} artifacts stamped`,
    ].join(" · ")
    write(pc.dim(`  ${line}`))
    write("")
  }
  if (ctx.extra.length) {
    printGroups(ctx.extra, write)
    write("")
  }
}

function printGroups(findings: Finding[], write: (s: string) => void) {
  for (const group of GROUPS) {
    const rows = findings.filter((f) => group.kinds.includes(f.kind))
    if (rows.length === 0) continue
    write("")
    write(
      `  ${group.tone(pc.bold(group.title))}${" ".repeat(Math.max(1, 48 - group.title.length))}${pc.dim(group.hint)}`
    )
    for (const f of rows) {
      write(`    ${f.id}${f.at ? pc.dim(`  (${f.at})`) : ""}`)
      write(pc.dim(`      ${f.kind}: ${f.detail}`))
    }
  }
}

export function printCheck(
  findings: Finding[],
  write: (s: string) => void = console.log
): void {
  for (const f of findings) {
    write(`${pc.red(f.kind.padEnd(24))} ${f.id}${f.at ? pc.dim(`  ${f.at}`) : ""}`)
    write(pc.dim(`${" ".repeat(25)}${f.detail}`))
  }
}
