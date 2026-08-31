// What "this artifact changed" means, per kind.
//
// A claim is an event: the slice that first made an artifact green. Events
// cannot notice that the thing they were about has moved, so every claim is
// paired with a digest of the artifact's content at the moment it was
// verified. The digest is over the *meaning*, not the bytes: a flow is its
// ordered steps and labels, a rule is its normalized text, a surface is its
// twelve answers including the waiver reasons.
//
// The test for whether something belongs here is whether a reviewer signs off
// on it. Anything the board shows them and this file omits can be changed
// afterwards with `check` still green -- which is the one failure the lock
// exists to prevent.
//
// The algorithm is versioned in the lock. Changing any normalization here
// bumps `DIGEST_ALGO` and migrates rather than turning every lock red at once.

import { createHash } from "node:crypto"
import { CHECKLIST_ROWS } from "./checklist"
import { surfaceId } from "./types"
import type { Flow, Spec, Surface } from "./types"

// 2: a state gained its title and the copy its assertion asserts against, and
// a surface gained its title -- all things a reviewer signs off on that used
// not move the artifact.
// 3: that title moved off the rendered case and onto the declaration, so it
// exists -- and is signed off on -- from the skeleton onwards rather than only
// once something renders.
export const DIGEST_ALGO = 3

export function sha256(input: string): string {
  return "sha256:" + createHash("sha256").update(input).digest("hex").slice(0, 24)
}

/** JSON with sorted keys, so two equal objects hash the same. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

/** Markdown and code normalized for hashing: trimmed lines, collapsed spaces, no blanks. */
export function normalizeText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n")
}

export function digestFlow(flow: Flow): string {
  return sha256(
    canonical({
      actor: flow.actor,
      spine: flow.spine.map((s) => ({
        case: s.case,
        on: s.on ?? null,
        end: s.end ?? null,
      })),
      deviations: flow.deviations.map((d) => ({
        from: d.from,
        when: d.when,
        case: d.case,
        rejoins: d.rejoins ?? null,
        end: d.end ?? null,
      })),
    })
  )
}

export function digestSurface(surface: Surface): string {
  return sha256(
    canonical({
      // The screen's name, because the board says it to a reviewer on every
      // chip and every lane header. Anything shown for sign-off is digested,
      // or it can be changed under the person who signed it.
      title: surface.title,
      rows: CHECKLIST_ROWS.map(({ row }) => {
        const a = surface.checklist[row]
        return a.state
          ? { row, state: a.state }
          : {
              row,
              waived: a.waived,
              witness: a.witness ?? null,
              review: a.review ?? null,
            }
      }),
    })
  )
}

/** A rule is its markdown, and its code where a `.ts` sits beside the `.md`. */
export function digestRule(markdown: string | null, code: string | null): string {
  return sha256(
    canonical({
      md: markdown ? normalizeText(markdown) : null,
      code: code ? normalizeText(code) : null,
    })
  )
}

export type StateContent = {
  surface: string | null
  row: string | null
  /** The declared name, which is what the board calls it to a reviewer. */
  name: string | null
  /** The `test("STATE-…` block(s) naming this ID, from e2e/state. */
  assertion: string | null
  /** The screenshot baseline's bytes, hashed. */
  baseline: string | null
  /** The COPY- entries this state's assertion asserts against. */
  copy: Record<string, string> | null
}

export function digestState(content: StateContent): string {
  return sha256(
    canonical({
      ...content,
      assertion: content.assertion ? normalizeText(content.assertion) : null,
    })
  )
}

/** Every digest the registry alone can produce: flows and surfaces. */
export function registryDigests(spec: Spec): Record<string, string> {
  const out: Record<string, string> = {}
  for (const flow of spec.flows) out[flow.id] = digestFlow(flow)
  for (const [key, surface] of Object.entries(spec.surfaces)) {
    out[surfaceId(spec.slug, key)] = digestSurface(surface)
  }
  return out
}
