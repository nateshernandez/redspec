// The traceability spine, counted -- and now bound.
//
// Every requirement is an artifact with an ID, and every slice claims the
// artifacts it makes green. This derives both sides from disk and the
// registry: artifacts from the specs and the rule files, claims from the
// `**Claims:**` list of each slice, and the lock for what was verified.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join, relative } from "node:path"
import { auditSpec } from "./audit"
import { actorsInBrief } from "./brief"
import type { SpecConfig } from "./config"
import {
  analyzeDecisionTable,
  parseDecisionTable,
  tableFindings,
  TableParseError,
} from "./decision-table"
import { digestRule, digestState, registryDigests } from "./digest"
import { sortFindings } from "./findings"
import type { Finding } from "./findings"
import type { LoadedSpec } from "./load"
import { compareLock, readLock } from "./lock"
import type { ClaimInfo, Lock } from "./lock"
import { declaredStateIds, resolveChecklistRow, resolveSurface } from "./audit"
import { ID_PATTERN } from "./types"

export type Artifact = { id: string; kind: string; source: string; slug: string }
export type Slice = {
  path: string
  slug: string
  claims: string[]
  amends: string[]
  status: string
}

const md = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .sort()
    : []

/** Rule IDs from filenames, never scraped from prose. */
export function ruleFiles(
  bundleDir: string
): { id: string; md: string | null; ts: string | null }[] {
  const dir = join(bundleDir, "rules")
  if (!existsSync(dir)) return []
  const ids = new Set(
    readdirSync(dir)
      .filter((f) => /\.(md|ts|tsx)$/.test(f) && !f.endsWith(".test.ts"))
      .map((f) => f.replace(/\.(md|ts|tsx)$/, ""))
  )
  return [...ids].sort().map((id) => {
    const mdPath = join(dir, `${id}.md`)
    const tsPath = existsSync(join(dir, `${id}.ts`))
      ? join(dir, `${id}.ts`)
      : join(dir, `${id}.tsx`)
    return {
      id,
      md: existsSync(mdPath) ? readFileSync(mdPath, "utf8") : null,
      ts: existsSync(tsPath) ? readFileSync(tsPath, "utf8") : null,
    }
  })
}

export function readSlices(root: string, bundleDir: string, slug: string): Slice[] {
  const dir = join(bundleDir, "slices")
  return md(dir).map((file) => {
    const body = readFileSync(join(dir, file), "utf8")
    const list = (label: string) => {
      const section = body.match(
        new RegExp(`\\*\\*${label}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|\\n##|$)`)
      )
      return section
        ? [...section[1]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.trim())
        : []
    }
    return {
      path: relative(root, join(dir, file)),
      slug,
      claims: list("Claims"),
      amends: list("Amends"),
      status: body.match(/\*\*Status:\*\*\s*(\w+)/)?.[1]?.toLowerCase() ?? "ready",
    }
  })
}

/** The `test("STATE-… …", …)` blocks in a Playwright file that name this ID. */
export function assertionBlocks(source: string, id: string): string | null {
  const blocks: string[] = []
  const re = new RegExp(`test(?:\\.\\w+)?\\(\\s*["'\`]${id}[^"'\`]*["'\`]`, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    // Walk to the matching close of the `test(` call by paren depth.
    let depth = 0
    let i = m.index + m[0].indexOf("(")
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++
      if (source[i] === ")") depth--
      if (depth === 0) break
    }
    blocks.push(source.slice(m.index, i + 1))
  }
  return blocks.length ? blocks.join("\n") : null
}

export type BundleReport = {
  slug: string
  artifacts: Artifact[]
  slices: Slice[]
  digests: Record<string, string>
  lock: Lock
  lockPath: string
  findings: Finding[]
}

export function reportBundle(
  root: string,
  config: SpecConfig,
  loaded: LoadedSpec,
  now = new Date()
): BundleReport {
  const { spec, dir } = loaded
  const slug = spec.slug
  const findings: Finding[] = []
  const artifacts: Artifact[] = []
  const digests: Record<string, string> = { ...registryDigests(spec) }

  // --- registry
  findings.push(
    ...auditSpec(spec, { now, requireWitness: config.waivers === "witnessed" })
  )

  const stateTest = join(root, config.stateTestsDir, `${slug}.spec.ts`)
  const stateSource = existsSync(stateTest) ? readFileSync(stateTest, "utf8") : null
  const snapDir = `${stateTest}-snapshots`
  for (const id of declaredStateIds(spec)) {
    artifacts.push({
      id,
      kind: "STATE",
      source: `specs/${slug}/${config.specFile}`,
      slug,
    })
    const baselines = existsSync(snapDir)
      ? readdirSync(snapDir)
          .filter((f) => f.startsWith(id))
          .sort()
      : []
    const baseline = baselines.length
      ? baselines.map((f) => readFileSync(join(snapDir, f)).toString("base64")).join("")
      : null
    digests[id] = digestState({
      surface: resolveSurface(spec, id),
      row: resolveChecklistRow(spec, id),
      assertion: stateSource ? assertionBlocks(stateSource, id) : null,
      baseline: baseline ? digestRule(baseline, null) : null,
      copy: null,
    })
  }
  for (const flow of spec.flows) {
    artifacts.push({
      id: flow.id,
      kind: "JOURNEY",
      source: `specs/${slug}/${config.specFile}`,
      slug,
    })
  }

  // --- bundle on disk
  const briefPath = join(dir, "BRIEF.md")
  if (!existsSync(briefPath)) {
    findings.push({
      kind: "missing-brief",
      id: slug,
      detail: `specs/${slug}/BRIEF.md does not exist.`,
    })
  } else {
    const walked = new Set(spec.flows.map((f) => f.actor))
    for (const actor of actorsInBrief(readFileSync(briefPath, "utf8"))) {
      if (!walked.has(actor)) {
        findings.push({
          kind: "actor-without-flow",
          id: actor,
          at: `specs/${slug}/BRIEF.md`,
          detail: `The Brief names "${actor}" and no flow has that actor. Whose path is missing?`,
        })
      }
    }
  }

  const rules = ruleFiles(dir)
  const ruleIds = new Set(rules.map((r) => r.id))
  for (const rule of rules) {
    if (!ID_PATTERN.test(rule.id) || !/^(RULE|INV)-/.test(rule.id)) {
      findings.push({
        kind: "bad-id",
        id: rule.id,
        detail:
          "Rule files are `RULE-<name>.md` or `INV-<name>.ts`, lowercase and hyphenated.",
      })
    }
    artifacts.push({
      id: rule.id,
      kind: rule.id.startsWith("INV") ? "INV" : "RULE",
      source: `specs/${slug}/rules/`,
      slug,
    })
    digests[rule.id] = digestRule(rule.md, rule.ts)
    if (rule.md && /\*\*Inputs:\*\*/.test(rule.md)) {
      try {
        const table = parseDecisionTable(rule.md, rule.id)
        findings.push(...tableFindings(table, analyzeDecisionTable(table)))
      } catch (e) {
        if (e instanceof TableParseError) {
          findings.push({ kind: "table-parse", id: rule.id, detail: e.message })
        } else throw e
      }
    }
  }
  for (const [key, surface] of Object.entries(spec.surfaces)) {
    for (const answer of Object.values(surface.checklist)) {
      if (answer.witness && !ruleIds.has(answer.witness)) {
        findings.push({
          kind: "unknown-witness",
          id: `SURFACE-${slug}-${key}`,
          detail: `A waiver names witness "${answer.witness}", and no rule file has that ID.`,
        })
      }
    }
  }

  // --- coverage
  const slices = readSlices(root, dir, slug)
  const known = new Set(artifacts.map((a) => a.id))
  const claimedBy = new Map<string, Slice[]>()
  for (const slice of slices) {
    for (const id of slice.claims)
      claimedBy.set(id, [...(claimedBy.get(id) ?? []), slice])
    if (slice.claims.length === 0) {
      findings.push({
        kind: "claimless",
        id: slice.path,
        detail: "Claims nothing: work nobody asked for. Find its artifact, or cut it.",
      })
    }
    for (const id of [...slice.claims, ...slice.amends]) {
      if (!ID_PATTERN.test(id)) {
        findings.push({
          kind: "bad-id",
          id,
          at: slice.path,
          detail: "Claimed IDs are lowercase and hyphenated after their prefix.",
        })
      }
    }
  }
  for (const a of artifacts) {
    if (!claimedBy.has(a.id)) {
      findings.push({
        kind: "orphan",
        id: a.id,
        at: a.source,
        detail:
          "A requirement nobody is building. Claim it in a slice, or delete it and say why in the Brief.",
      })
    }
  }
  for (const [id, by] of claimedBy) {
    if (!known.has(id)) {
      findings.push({
        kind: "unknown-id",
        id,
        at: by.map((s) => s.path).join(", "),
        detail:
          "Claimed, but no artifact has this ID. A typo, or a rename that missed its slice.",
      })
    }
    // One base claim; any number of amendment slices may re-claim it.
    const base = by.filter((s) => !s.amends.includes(id))
    if (base.length > 1) {
      findings.push({
        kind: "claimed-twice",
        id,
        at: base.map((s) => s.path).join(", "),
        detail:
          "Two slices both claim to first make this green. One of them is an amendment, or one of them is wrong.",
      })
    }
  }

  // --- lock
  const lockPath = join(dir, ".spec-lock.json")
  const lock = readLock(lockPath)
  const claims: Record<string, ClaimInfo> = {}
  for (const [id, by] of claimedBy) {
    // The most recent claimant -- an amendment slice if there is one -- owns verification.
    const owner = by[by.length - 1]!
    claims[id] = { slice: owner.path, done: owner.status === "done" }
  }
  findings.push(...compareLock(lock, digests, claims))

  return {
    slug,
    artifacts,
    slices,
    digests,
    lock,
    lockPath,
    findings: sortFindings(findings),
  }
}

/** The bundle directories with no spec file: declared on disk, unknown to the app. */
export function unregisteredBundles(
  root: string,
  config: SpecConfig,
  loaded: LoadedSpec[]
): Finding[] {
  const dir = join(root, config.specsDir)
  if (!existsSync(dir)) return []
  const known = new Set(loaded.map((l) => basename(l.dir)))
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !known.has(e.name))
    .map((e) => ({
      kind: "unregistered-feature" as const,
      id: e.name,
      detail: `specs/${e.name}/ has no ${config.specFile}. Run \`redspec new feature ${e.name}\` or delete the directory.`,
    }))
}
