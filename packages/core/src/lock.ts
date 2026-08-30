// The lock: what each claimed artifact looked like when the slice that claimed
// it was verified green.
//
// One entry per line, keys sorted, no nesting -- so two slices stamping the
// same week merge cleanly, and where they do not, `redspec accept` regenerates
// the line from a test run rather than asking anyone to hand-merge a hash.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { DIGEST_ALGO } from "./digest"
import type { Finding } from "./findings"

export type LockEntry = {
  digest: string
  /** The slice whose run stamped this. */
  slice: string
  at: string
  commit?: string
  /** Set when `accept --clarification` re-stamped without a behavioural change. */
  note?: string
}

export type Lock = {
  algo: number
  entries: Record<string, LockEntry>
}

export const emptyLock = (): Lock => ({ algo: DIGEST_ALGO, entries: {} })

export function readLock(path: string): Lock {
  if (!existsSync(path)) return emptyLock()
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Lock>
  return { algo: parsed.algo ?? 0, entries: parsed.entries ?? {} }
}

export function serializeLock(lock: Lock): string {
  const ids = Object.keys(lock.entries).sort()
  const lines = ids.map((id) => {
    const e = lock.entries[id]!
    const fields = [
      `"digest":${JSON.stringify(e.digest)}`,
      `"slice":${JSON.stringify(e.slice)}`,
      `"at":${JSON.stringify(e.at)}`,
    ]
    if (e.commit) fields.push(`"commit":${JSON.stringify(e.commit)}`)
    if (e.note) fields.push(`"note":${JSON.stringify(e.note)}`)
    return `    ${JSON.stringify(id)}: {${fields.join(",")}}`
  })
  return `{\n  "algo": ${lock.algo},\n  "entries": {\n${lines.join(",\n")}\n  }\n}\n`
}

export function writeLock(path: string, lock: Lock): void {
  writeFileSync(path, serializeLock(lock))
}

export type ClaimInfo = {
  /** Slice path that owns the claim. */
  slice: string
  /** The slice file says `**Status:** done`. */
  done: boolean
}

/**
 * Compare what the lock recorded against what the artifacts digest to now.
 *
 * - `amended`: verified once, content has moved since, nothing re-verified it.
 * - `unverified`: claimed by a slice marked done, never stamped.
 */
export function compareLock(
  lock: Lock,
  current: Record<string, string>,
  claims: Record<string, ClaimInfo>
): Finding[] {
  const findings: Finding[] = []
  for (const [id, entry] of Object.entries(lock.entries)) {
    const now = current[id]
    if (now === undefined) continue // deleted: coverage reports the claim on an unknown ID
    if (now !== entry.digest) {
      findings.push({
        kind: "amended",
        id,
        at: entry.slice,
        detail: `Verified ${entry.at.slice(0, 10)} by ${entry.slice} against ${entry.digest}; content is now ${now}. Cut an amendment slice, or \`redspec accept ${id}\` after a passing run.`,
      })
    }
  }
  for (const [id, claim] of Object.entries(claims)) {
    if (!claim.done || lock.entries[id] || current[id] === undefined) continue
    findings.push({
      kind: "unverified",
      id,
      at: claim.slice,
      detail: `${claim.slice} is marked done but never stamped this artifact. Run \`redspec accept ${id}\`.`,
    })
  }
  return findings
}

export function stamp(
  lock: Lock,
  ids: string[],
  current: Record<string, string>,
  slice: string,
  extra: { commit?: string; note?: string; at?: Date } = {}
): Lock {
  const entries = { ...lock.entries }
  for (const id of ids) {
    const digest = current[id]
    if (!digest)
      throw new Error(
        `No artifact digests to "${id}". Is the ID spelled as it is declared?`
      )
    entries[id] = {
      digest,
      slice,
      at: (extra.at ?? new Date()).toISOString(),
      ...(extra.commit ? { commit: extra.commit } : {}),
      ...(extra.note ? { note: extra.note } : {}),
    }
  }
  return { algo: DIGEST_ALGO, entries }
}
