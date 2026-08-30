// Total decision tables.
//
// A golden table of six remembered rows is a list of examples. A decision
// table declares its input domains and a hit policy, and then two things can
// be *proved* about it before a single row runs: that no input combination is
// matched by no row (a gap), and that no combination is matched by two rows
// under a UNIQUE policy (an overlap). That is the jump from "the values
// somebody thought of" to "the input space is partitioned, and here's the
// proof" -- the analyses DMN tooling has run for a decade, in markdown.
//
// Grammar, all in one `## RULE-…` markdown block:
//
//   **Inputs:** hours: number(0..), plan: {free, pro}, admin: boolean
//   **Hit policy:** UNIQUE          (UNIQUE | FIRST | ANY; default UNIQUE)
//
//   | hours   | plan  | admin | rate  | note        |
//   | ------- | ----- | ----- | ----- | ----------- |
//   | [0..40] | -     | -     | 1     | straight    |
//   | (40..]  | free  | -     | 1.5   | overtime    |
//
// Cells on input columns: `-` any; `[a..b]` / `(a..b]` / `[a..)` / `(..b]`
// numeric intervals; `a` an exact number or enum value; `{a, b}` an enum set;
// `true`/`false`. Columns not declared as inputs are outputs.

import type { Finding } from "./findings"

export type NumberDomain = { kind: "number"; min: number; max: number }
export type EnumDomain = { kind: "enum"; values: string[] }
export type BooleanDomain = { kind: "boolean" }
export type Domain = NumberDomain | EnumDomain | BooleanDomain

export type Interval = { lo: number; loOpen: boolean; hi: number; hiOpen: boolean }
export type Cell =
  | { kind: "any" }
  | { kind: "interval"; interval: Interval }
  | { kind: "set"; values: string[] }

export type Rule = { index: number; inputs: Cell[]; outputs: Record<string, string> }

export type DecisionTable = {
  id: string
  inputs: { name: string; domain: Domain }[]
  outputColumns: string[]
  hitPolicy: "UNIQUE" | "FIRST" | "ANY"
  rules: Rule[]
}

export class TableParseError extends Error {}

const INF = Number.POSITIVE_INFINITY

export function parseDomain(spec: string): Domain {
  const s = spec.trim()
  if (s === "boolean") return { kind: "boolean" }
  const num = s.match(/^number(?:\(\s*(-?[\d.]+)?\s*\.\.\s*(-?[\d.]+)?\s*\))?$/)
  if (num) {
    return {
      kind: "number",
      min: num[1] !== undefined ? Number(num[1]) : -INF,
      max: num[2] !== undefined ? Number(num[2]) : INF,
    }
  }
  const en = s.match(/^\{(.+)\}$/)
  if (en)
    return {
      kind: "enum",
      values: en[1]!
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }
  throw new TableParseError(
    `Cannot read input domain "${spec}". Use number, number(a..b), {a, b}, or boolean.`
  )
}

export function parseCell(raw: string, domain: Domain): Cell {
  const s = raw.trim()
  if (s === "-" || s === "" || s === "*") return { kind: "any" }
  if (domain.kind === "number") {
    const iv = s.match(/^([\[(])\s*(-?[\d.]+)?\s*\.\.\s*(-?[\d.]+)?\s*([\])])$/)
    if (iv) {
      return {
        kind: "interval",
        interval: {
          lo: iv[2] !== undefined ? Number(iv[2]) : domain.min,
          loOpen: iv[1] === "(" && iv[2] !== undefined,
          hi: iv[3] !== undefined ? Number(iv[3]) : domain.max,
          hiOpen: iv[4] === ")" && iv[3] !== undefined,
        },
      }
    }
    const cmp = s.match(/^(<=|>=|<|>)\s*(-?[\d.]+)$/)
    if (cmp) {
      const n = Number(cmp[2])
      const op = cmp[1]
      return {
        kind: "interval",
        interval:
          op === "<"
            ? { lo: domain.min, loOpen: false, hi: n, hiOpen: true }
            : op === "<="
              ? { lo: domain.min, loOpen: false, hi: n, hiOpen: false }
              : op === ">"
                ? { lo: n, loOpen: true, hi: domain.max, hiOpen: false }
                : { lo: n, loOpen: false, hi: domain.max, hiOpen: false },
      }
    }
    if (/^-?[\d.]+$/.test(s)) {
      const n = Number(s)
      return {
        kind: "interval",
        interval: { lo: n, loOpen: false, hi: n, hiOpen: false },
      }
    }
    throw new TableParseError(`"${raw}" is not a number, interval, or comparison.`)
  }
  const values = s.match(/^\{(.+)\}$/)
    ? s
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim())
    : [s]
  const allowed = domain.kind === "boolean" ? ["true", "false"] : domain.values
  for (const v of values) {
    if (!allowed.includes(v)) {
      throw new TableParseError(`"${v}" is not one of {${allowed.join(", ")}}.`)
    }
  }
  return { kind: "set", values }
}

/** Parse the first `## RULE-…` block of a markdown file, or the whole file if it has none. */
export function parseDecisionTable(markdown: string, idHint?: string): DecisionTable {
  const idMatch = markdown.match(/^#+\s+((?:RULE|INV)-[a-z0-9-]+)\s*$/m)
  const id = idMatch?.[1] ?? idHint
  if (!id) throw new TableParseError("No `## RULE-…` heading and no ID given.")

  const inputsLine = markdown.match(/\*\*Inputs:\*\*\s*(.+)/)
  if (!inputsLine)
    throw new TableParseError(
      "No `**Inputs:**` line. A total table declares its domains."
    )
  const inputs = splitTopLevel(inputsLine[1]!).map((part) => {
    const m = part.match(/^\s*([A-Za-z_][\w]*)\s*:\s*(.+?)\s*$/)
    if (!m) throw new TableParseError(`Cannot read input "${part}". Use name: domain.`)
    return { name: m[1]!, domain: parseDomain(m[2]!) }
  })

  const policy = (
    markdown.match(/\*\*Hit policy:\*\*\s*(UNIQUE|FIRST|ANY)/i)?.[1] ?? "UNIQUE"
  ).toUpperCase() as DecisionTable["hitPolicy"]

  const rows = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .map((l) =>
      l
        .slice(1, l.endsWith("|") ? -1 : undefined)
        .split("|")
        .map((c) => c.trim())
    )
  if (rows.length < 2) throw new TableParseError("No markdown table found.")
  const header = rows[0]!
  const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)))

  const inputIdx = inputs.map(({ name }) => {
    const i = header.indexOf(name)
    if (i === -1)
      throw new TableParseError(`Input "${name}" is declared but has no column.`)
    return i
  })
  const outputColumns = header.filter((h, i) => !inputIdx.includes(i))

  const rules: Rule[] = body.map((cells, index) => {
    const ins = inputs.map((input, k) => {
      try {
        return parseCell(cells[inputIdx[k]!] ?? "-", input.domain)
      } catch (e) {
        throw new TableParseError(
          `Row ${index + 1}, column "${input.name}": ${(e as Error).message}`
        )
      }
    })
    const outputs: Record<string, string> = {}
    header.forEach((h, i) => {
      if (!inputIdx.includes(i)) outputs[h] = cells[i] ?? ""
    })
    return { index: index + 1, inputs: ins, outputs }
  })

  return { id, inputs, outputColumns, hitPolicy: policy, rules }
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "{" || ch === "(") depth++
    if (ch === "}" || ch === ")") depth--
    if (ch === "," && depth === 0) {
      parts.push(cur)
      cur = ""
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

// ---- analysis ------------------------------------------------------------

/** An elementary region of one input: a point, an open interval, or one enum value. */
type Region =
  | { kind: "point"; at: number }
  | { kind: "open"; lo: number; hi: number }
  | { kind: "value"; value: string }

function regionsFor(domain: Domain, cells: Cell[]): Region[] {
  if (domain.kind !== "number") {
    const values = domain.kind === "boolean" ? ["true", "false"] : domain.values
    return values.map((value) => ({ kind: "value", value }))
  }
  const points = new Set<number>([domain.min, domain.max])
  for (const c of cells) {
    if (c.kind !== "interval") continue
    points.add(c.interval.lo)
    points.add(c.interval.hi)
  }
  const sorted = [...points]
    .filter((p) => Number.isFinite(p) || p === domain.min || p === domain.max)
    .sort((a, b) => a - b)
  const regions: Region[] = []
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!
    if (Number.isFinite(p)) regions.push({ kind: "point", at: p })
    const next = sorted[i + 1]
    if (next !== undefined && next !== p) regions.push({ kind: "open", lo: p, hi: next })
  }
  return regions
}

function cellCovers(cell: Cell, region: Region): boolean {
  if (cell.kind === "any") return true
  if (cell.kind === "set")
    return region.kind === "value" && cell.values.includes(region.value)
  const { lo, loOpen, hi, hiOpen } = cell.interval
  if (region.kind === "point") {
    const aboveLo = loOpen ? region.at > lo : region.at >= lo
    const belowHi = hiOpen ? region.at < hi : region.at <= hi
    return aboveLo && belowHi
  }
  if (region.kind === "open") return region.lo >= lo && region.hi <= hi
  return false
}

function describe(region: Region, name: string): string {
  if (region.kind === "value") return `${name} = ${region.value}`
  if (region.kind === "point") return `${name} = ${region.at}`
  const lo = Number.isFinite(region.lo) ? String(region.lo) : "-∞"
  const hi = Number.isFinite(region.hi) ? String(region.hi) : "∞"
  return `${name} ∈ (${lo}..${hi})`
}

export type TableAnalysis = {
  cells: number
  gaps: string[]
  overlaps: { rules: number[]; where: string }[]
  truncated: boolean
}

/** Walk every elementary cell of the input space and count the rules that match it. */
export function analyzeDecisionTable(
  table: DecisionTable,
  maxCells = 50_000
): TableAnalysis {
  const perInput = table.inputs.map((input, k) =>
    regionsFor(
      input.domain,
      table.rules.map((r) => r.inputs[k]!)
    )
  )
  const total = perInput.reduce((n, r) => n * r.length, 1)
  const gaps: string[] = []
  const overlaps: TableAnalysis["overlaps"] = []
  let visited = 0
  let truncated = false

  const walk = (k: number, chosen: Region[]) => {
    if (truncated) return
    if (k === perInput.length) {
      visited++
      if (visited > maxCells) {
        truncated = true
        return
      }
      const hits = table.rules.filter((rule) =>
        rule.inputs.every((cell, i) => cellCovers(cell, chosen[i]!))
      )
      const where = chosen.map((r, i) => describe(r, table.inputs[i]!.name)).join(", ")
      if (hits.length === 0) gaps.push(where)
      if (hits.length > 1 && table.hitPolicy === "UNIQUE") {
        overlaps.push({ rules: hits.map((h) => h.index), where })
      }
      return
    }
    for (const region of perInput[k]!) walk(k + 1, [...chosen, region])
  }
  walk(0, [])

  return { cells: total, gaps: mergeGapDescriptions(gaps), overlaps, truncated }
}

/** Adjacent point/open gaps read better as one line; keep it simple and dedupe. */
function mergeGapDescriptions(gaps: string[]): string[] {
  return [...new Set(gaps)]
}

export function tableFindings(table: DecisionTable, analysis: TableAnalysis): Finding[] {
  const findings: Finding[] = []
  for (const gap of analysis.gaps) {
    findings.push({
      kind: "table-gap",
      id: table.id,
      detail: `${gap} is matched by no row.`,
    })
  }
  for (const o of analysis.overlaps) {
    findings.push({
      kind: "table-overlap",
      id: table.id,
      detail: `Rows ${o.rules.join(" and ")} both match ${o.where}, and the hit policy is UNIQUE.`,
    })
  }
  return findings
}

/** The rows that match a concrete input, in table order. The test driver's half. */
export function matchRules(
  table: DecisionTable,
  input: Record<string, number | string | boolean>
): Rule[] {
  return table.rules.filter((rule) =>
    rule.inputs.every((cell, k) => {
      const name = table.inputs[k]!.name
      const value = input[name]
      if (cell.kind === "any") return true
      if (cell.kind === "set") return cell.values.includes(String(value))
      const n = Number(value)
      const { lo, loOpen, hi, hiOpen } = cell.interval
      return (loOpen ? n > lo : n >= lo) && (hiOpen ? n < hi : n <= hi)
    })
  )
}

/** Decide one input under the table's hit policy. `null` when no rule matches. */
export function decide(
  table: DecisionTable,
  input: Record<string, number | string | boolean>
): Record<string, string> | null {
  const hits = matchRules(table, input)
  if (hits.length === 0) return null
  if (table.hitPolicy === "FIRST") return hits[0]!.outputs
  if (table.hitPolicy === "UNIQUE" && hits.length > 1) {
    throw new Error(
      `${table.id}: rows ${hits.map((h) => h.index).join(", ")} all match ${JSON.stringify(input)} under UNIQUE.`
    )
  }
  return hits[0]!.outputs
}

/**
 * One representative input per elementary cell, so a property test can drive
 * the implementation across every region the table distinguishes rather than
 * only at the listed points.
 */
export function representativeInputs(
  table: DecisionTable,
  max = 5000
): Record<string, number | string | boolean>[] {
  const perInput = table.inputs.map((input, k) =>
    regionsFor(
      input.domain,
      table.rules.map((r) => r.inputs[k]!)
    )
  )
  const out: Record<string, number | string | boolean>[] = []
  const walk = (k: number, chosen: Record<string, number | string | boolean>) => {
    if (out.length >= max) return
    if (k === perInput.length) {
      out.push(chosen)
      return
    }
    const name = table.inputs[k]!.name
    const domain = table.inputs[k]!.domain
    for (const region of perInput[k]!) {
      let v: number | string | boolean
      if (region.kind === "value")
        v = domain.kind === "boolean" ? region.value === "true" : region.value
      else if (region.kind === "point") v = region.at
      else if (!Number.isFinite(region.hi)) v = region.lo + 1
      else if (!Number.isFinite(region.lo)) v = region.hi - 1
      else v = (region.lo + region.hi) / 2
      walk(k + 1, { ...chosen, [name]: v })
    }
  }
  walk(0, {})
  return out
}
