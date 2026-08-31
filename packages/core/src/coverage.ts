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
import { ID_PATTERN, surfaceId } from "./types"

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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * `test("<ID> <intent>", …)` naming this ID and not one it is merely a prefix
 * of. Without the boundary, `STATE-demo-roster` matches
 * `STATE-demo-roster-empty`'s test and swallows another state's contract into
 * its digest -- which would make one state amend when a different one moved.
 */
const testTitleRe = (id: string) =>
  new RegExp(
    `test(?:\\.\\w+)?\\(\\s*["'\`](${escapeRe(id)}(?![-a-z0-9])[^"'\`]*)["'\`]`,
    "g"
  )

/**
 * The `COPY-` IDs a piece of source *asserts against*, deduped and sorted.
 *
 * Only quoted ones: `copy["COPY-…"]` is a reference, `// renamed from COPY-…`
 * and a URL ending in `COPY-…` are not. Scanning bare text turns a comment
 * into a red `unknown-copy`, and worse, folds a string the state does not use
 * into its digest.
 */
export function copyIdsIn(text: string | null): string[] {
  if (!text) return []
  const found = new Set<string>()
  const re = /["'`](COPY-[a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) found.add(m[1]!)
  return [...found].sort()
}

/**
 * The index of the `)` closing the call whose `(` is at `open`.
 *
 * Naive paren counting reads parens inside strings, comments, and regex
 * literals, any one of which can carry an unbalanced one: `getByText("Oops :(")`
 * truncates the block, and everything after it -- including the `COPY-` the
 * assertion checks -- silently leaves the state's digest. A truncated block is
 * the worst failure this file has, because the artifact stays green forever.
 */
function closingParen(source: string, open: number): number {
  let depth = 0
  // What a `/` may follow and still start a regex rather than be a division.
  let prev = ""
  for (let i = open; i < source.length; i++) {
    const c = source[i]!
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++
      continue
    }
    if (c === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i + 2)
      if (i === -1) return source.length - 1
      i++
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      i = endOfString(source, i)
      prev = c
      continue
    }
    if (c === "/" && /[([{,;:=!&|?+\-*%~^<>]/.test(prev)) {
      i = endOfRegex(source, i)
      prev = "/"
      continue
    }
    if (c === "(") depth++
    else if (c === ")" && --depth === 0) return i
    if (!/\s/.test(c)) prev = c
  }
  return source.length - 1
}

/** Index of the quote closing the string opened at `start`. */
function endOfString(source: string, start: number): number {
  const quote = source[start]!
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i]!
    if (c === "\\") {
      i++
      continue
    }
    if (c === quote) return i
    // A template's `${…}` is code again, and may hold strings of its own.
    if (quote === "`" && c === "$" && source[i + 1] === "{") {
      i = closingBrace(source, i + 1)
      continue
    }
    // An unterminated single- or double-quoted string ends at the line.
    if (quote !== "`" && c === "\n") return i
  }
  return source.length - 1
}

/** Index of the `}` closing the brace at `open`, strings and all. */
function closingBrace(source: string, open: number): number {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const c = source[i]!
    if (c === '"' || c === "'" || c === "`") {
      i = endOfString(source, i)
      continue
    }
    if (c === "{") depth++
    else if (c === "}" && --depth === 0) return i
  }
  return source.length - 1
}

/** Index of the `/` closing the regex opened at `start`. */
function endOfRegex(source: string, start: number): number {
  let inClass = false
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i]!
    if (c === "\\") {
      i++
      continue
    }
    if (c === "[") inClass = true
    else if (c === "]") inClass = false
    else if (c === "/" && !inClass) return i
    else if (c === "\n") return i
  }
  return source.length - 1
}

/** The `test("STATE-… …", …)` blocks in a Playwright file that name this ID. */
export function assertionBlocks(source: string, id: string): string | null {
  const blocks: string[] = []
  const re = testTitleRe(id)
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const open = m.index + m[0].indexOf("(")
    blocks.push(source.slice(m.index, closingParen(source, open) + 1))
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
    const assertion = stateSource ? assertionBlocks(stateSource, id) : null

    // The words are part of the state, so changing one has to amend it. Which
    // words belong to *this* state is answered by its assertion: a sketch may
    // render a string nothing checks, and a string nothing checks is not part
    // of the contract anyone signed.
    let copy: Record<string, string> | null = null
    if (loaded.copy) {
      const used: Record<string, string> = {}
      for (const copyId of copyIdsIn(assertion)) {
        const value = loaded.copy[copyId]
        if (value === undefined) {
          findings.push({
            kind: "unknown-copy",
            id: copyId,
            at: relative(root, stateTest),
            detail: `The assertion for ${id} names "${copyId}", and copy.ts has no such entry. A typo, or a rename that missed.`,
          })
          continue
        }
        used[copyId] = value
      }
      copy = Object.keys(used).length > 0 ? used : null
    }

    digests[id] = digestState({
      surface: resolveSurface(spec, id),
      row: resolveChecklistRow(spec, id),
      name: spec.states?.[id]?.trim() || null,
      assertion,
      baseline: baseline ? digestRule(baseline, null) : null,
      copy,
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
  // A surface is an artifact in its own right: its twelve answers, and the
  // waiver reasons among them. `registryDigests` has always digested it -- and
  // until it was registered here nothing could claim it, so nothing could stamp
  // it, so softening a waiver moved a requirement with no way to notice.
  for (const key of Object.keys(spec.surfaces)) {
    artifacts.push({
      id: surfaceId(slug, key),
      kind: "SURFACE",
      source: `specs/${slug}/${config.specFile}`,
      slug,
    })
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
          id: surfaceId(slug, key),
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
