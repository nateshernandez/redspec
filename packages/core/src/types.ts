// The shapes a feature declares so its states can be reviewed on a board.
//
// The sign-off is enforced here rather than by convention: a checklist row left
// out does not compile, and a flow step with nowhere to go does not compile. A
// state that is only declared -- named by a checklist row or a flow step, with
// nothing rendering it -- is legal and expected, which is why every reference
// to a case is a plain `string` rather than a key of `cases`.

import type { ReactNode } from "react"
import type { ChecklistRow } from "./checklist"

export type { ChecklistRow }

/**
 * A row is answered by a state ID, or waived with the reason this surface
 * cannot be in that state. A waiver is a claim about the product, so it is
 * written out rather than left as an absence -- and it can carry a `witness`,
 * the RULE- or INV- that would go red the day the claim stops holding, or a
 * `review` date after which the audit asks for it to be re-read.
 */
export type ChecklistAnswer =
  | { state: string; waived?: never; witness?: never; review?: never }
  | { state?: never; waived: string; witness?: string; review?: string }

/** A distinct screen. Its checklist is the omission check. */
export type Surface = {
  title: string
  /** All twelve rows are required by the type, so a row cannot be dropped. */
  checklist: Record<ChecklistRow, ChecklistAnswer>
}

/** One state of one surface, rendered from a fixture and nothing else. */
export type Case = {
  title: string
  /** The key in `surfaces` this is a state of. Audited, not typed. */
  surface: string
  render: () => ReactNode
}

/**
 * One step on a flow's happy path. It either leads onward -- `on` names the
 * action that takes the person to the next step -- or it ends, and then it says
 * what the person is left with. Never both, and never neither.
 */
export type FlowStep =
  { case: string; on: string; end?: never } | { case: string; on?: never; end: string }

/**
 * A departure from the spine, hanging off the step it branches from. It either
 * rejoins the spine at a named step or it ends -- and an end is a decision, so
 * it says what the person is left with.
 */
export type FlowDeviation =
  | { from: string; when: string; case: string; rejoins: string; end?: never }
  | { from: string; when: string; case: string; rejoins?: never; end: string }

/** One actor getting what they came for. */
export type Flow = {
  /** `JOURNEY-<feature>-<intent>`, shared with the Playwright spec. */
  id: string
  title: string
  /** Must match an actor named in the feature's BRIEF.md. */
  actor: string
  spine: FlowStep[]
  deviations: FlowDeviation[]
}

/** Everything one feature declares. */
export type Spec = {
  slug: string
  title: string
  surfaces: Record<string, Surface>
  /** Empty after `/draft-skeleton`. The board still draws every state. */
  cases: Record<string, Case>
  flows: Flow[]
}

/** Identity function that pins the type. `export default defineSpec({...})`. */
export const defineSpec = (spec: Spec): Spec => spec

/**
 * The copy catalog: every user-facing string a feature ships, keyed by a
 * `COPY-` ID. Sketches render from it and assertions assert against it, so a
 * word changes in one place and both readers see the change.
 */
export const defineCopy = <T extends Record<`COPY-${string}`, string>>(copy: T): T => copy

export const ID_PATTERN = /^(STATE|JOURNEY|RULE|INV|COPY|SURFACE)-[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * The lockable ID of one surface: its twelve answers, waiver reasons included.
 * A waiver is the only prose left in a bundle and it is a claim about the
 * product, so it is an artifact a slice claims and the lock stamps like any
 * other -- otherwise softening one is a requirement moving with nothing to
 * notice.
 */
export const surfaceId = (slug: string, key: string): string => `SURFACE-${slug}-${key}`
export type ArtifactKind = "STATE" | "JOURNEY" | "RULE" | "INV" | "COPY" | "SURFACE"

export const kindOf = (id: string): ArtifactKind | null => {
  const prefix = id.split("-")[0]
  return prefix === "STATE" ||
    prefix === "JOURNEY" ||
    prefix === "RULE" ||
    prefix === "INV" ||
    prefix === "COPY" ||
    prefix === "SURFACE"
    ? prefix
    : null
}
