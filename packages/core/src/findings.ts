// One finding shape for everything that can be wrong about a spec, wherever it
// was found -- the registry, the bundle on disk, or the lock.

export type FindingKind =
  // audit: the registry against itself
  | "declared-not-rendered"
  | "off-path"
  | "off-checklist"
  | "unclaimed-id"
  | "unknown-surface"
  | "surface-mismatch"
  | "dangling-deviation"
  | "deviation-off-deviation"
  | "compound-actor"
  | "spine-ends-early"
  | "empty-spine"
  | "bad-id"
  | "unnamed-state"
  | "waiver-due"
  | "waiver-unwitnessed"
  // bundle: the registry against specs/<slug>/
  | "actor-without-flow"
  | "unknown-witness"
  | "unknown-copy"
  | "missing-brief"
  | "unregistered-feature"
  // coverage: artifacts against slices
  | "orphan"
  | "claimless"
  | "unknown-id"
  | "claimed-twice"
  // lock: artifacts against what was verified
  | "amended"
  | "unverified"
  // rules
  | "table-gap"
  | "table-overlap"
  | "table-parse"

export type Finding = {
  kind: FindingKind
  /** The state ID, flow ID, surface key, slice path, or rule ID the finding is about. */
  id: string
  detail: string
  /** Where a fix lands, when it is not the artifact itself. */
  at?: string
}

/** Findings that mean the skeleton is doing its job rather than that something is wrong. */
export const WORK_LIST_KINDS: ReadonlySet<FindingKind> = new Set([
  "declared-not-rendered",
])

export const sortFindings = (findings: Finding[]): Finding[] =>
  [...findings].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
