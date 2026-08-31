// What the types cannot reach.
//
// The types stop a checklist row being dropped and a flow step going nowhere.
// Everything else that can be wrong about a spec is a relationship between two
// declarations, so it is derived from both sides here and reported as a list.
//
// That list is also the work list `/render-states` reads, which is why a state
// that is declared and not yet rendered is its own finding: it is the whole
// skeleton after `/draft-skeleton`, red and correct at the same time, and it
// must not read like the typo that `unclaimed-id` is.

import { CHECKLIST_ROWS } from "./checklist"
import type { ChecklistRow } from "./checklist"
import { sortFindings } from "./findings"
import type { Finding } from "./findings"
import { ID_PATTERN, surfaceId } from "./types"
import type { Spec } from "./types"

export type AuditOptions = {
  /** "Today", for waiver review dates. Defaults to the real clock. */
  now?: Date
  /** Require every waiver to name a witness rule. Off by default. */
  requireWitness?: boolean
}

/** The surface a checklist row places a state on, if any row names it. */
export function surfaceByChecklist(spec: Spec, stateId: string): string | null {
  for (const [key, surface] of Object.entries(spec.surfaces)) {
    for (const answer of Object.values(surface.checklist)) {
      if (answer.state === stateId) return key
    }
  }
  return null
}

/**
 * Which surface a state belongs to. A rendered case says so directly; a state
 * that is only declared is placed by the checklist row that names it, which is
 * how a stub knows what to draw on its chip.
 */
export function resolveSurface(spec: Spec, stateId: string): string | null {
  return spec.cases[stateId]?.surface ?? surfaceByChecklist(spec, stateId)
}

/** The checklist row a state answers, if any. Drawn on the stub's chip. */
export function resolveChecklistRow(spec: Spec, stateId: string): ChecklistRow | null {
  for (const surface of Object.values(spec.surfaces)) {
    for (const { row } of CHECKLIST_ROWS) {
      if (surface.checklist[row].state === stateId) return row
    }
  }
  return null
}

/** Every state ID some checklist row answers. */
export function checklistStateIds(spec: Spec): Set<string> {
  const ids = new Set<string>()
  for (const surface of Object.values(spec.surfaces)) {
    for (const answer of Object.values(surface.checklist)) {
      if (answer.state) ids.add(answer.state)
    }
  }
  return ids
}

/** Every state ID some flow walks. */
export function reachedStateIds(spec: Spec): Set<string> {
  const ids = new Set<string>()
  for (const flow of spec.flows) {
    for (const step of flow.spine) ids.add(step.case)
    for (const deviation of flow.deviations) ids.add(deviation.case)
  }
  return ids
}

/** Every state ID this spec names, whether or not anything renders it. */
export function declaredStateIds(spec: Spec): string[] {
  return [
    ...new Set([
      ...checklistStateIds(spec),
      ...reachedStateIds(spec),
      ...Object.keys(spec.cases),
    ]),
  ]
}

export function auditSpec(spec: Spec, options: AuditOptions = {}): Finding[] {
  const findings: Finding[] = []
  const now = options.now ?? new Date()
  const rendered = new Set(Object.keys(spec.cases))
  const reached = reachedStateIds(spec)
  const onChecklist = checklistStateIds(spec)
  const declared = declaredStateIds(spec)

  for (const id of declared) {
    if (!ID_PATTERN.test(id)) {
      findings.push({
        kind: "bad-id",
        id,
        detail: "IDs are `STATE-<feature>-<case>`, lowercase and hyphenated.",
      })
    }
    if (!id.startsWith("STATE-") && ID_PATTERN.test(id)) {
      findings.push({ kind: "bad-id", id, detail: "A state ID starts with `STATE-`." })
    }
  }
  for (const flow of spec.flows) {
    if (!ID_PATTERN.test(flow.id) || !flow.id.startsWith("JOURNEY-")) {
      findings.push({
        kind: "bad-id",
        id: flow.id,
        detail: "Flow IDs are `JOURNEY-<feature>-<intent>`, lowercase and hyphenated.",
      })
    }
  }

  for (const id of declared) {
    if (rendered.has(id)) continue
    findings.push({
      kind: "declared-not-rendered",
      id,
      detail: `Declared by ${onChecklist.has(id) ? "a checklist row" : "a flow"}${
        reached.has(id) && onChecklist.has(id) ? " and walked by a flow" : ""
      }; no case renders it yet.`,
    })
  }

  for (const id of rendered) {
    if (reached.has(id)) continue
    findings.push(
      onChecklist.has(id)
        ? {
            kind: "off-path",
            id,
            detail: "Renders, but no flow reaches it. Place it, or delete it.",
          }
        : {
            kind: "unclaimed-id",
            id,
            detail:
              "Named by no checklist row and no flow. A typo, or a rename that missed.",
          }
    )
  }

  // A state a flow walks that no checklist row names has bypassed the
  // omission check: the surfaces view never shows it, so nobody asks which of
  // the twelve it is.
  for (const id of reached) {
    if (onChecklist.has(id)) continue
    findings.push({
      kind: "off-checklist",
      id,
      detail:
        "Walked by a flow but named by no checklist row. Which of the twelve is it?",
    })
  }

  for (const [id, entry] of Object.entries(spec.cases)) {
    if (!spec.surfaces[entry.surface]) {
      findings.push({
        kind: "unknown-surface",
        id,
        detail: `Names surface "${entry.surface}", which this spec does not declare.`,
      })
      continue
    }
    const byRow = surfaceByChecklist(spec, id)
    if (byRow && byRow !== entry.surface) {
      findings.push({
        kind: "surface-mismatch",
        id,
        detail: `The case says surface "${entry.surface}"; the checklist row that names it is on "${byRow}". Both cannot be true.`,
      })
    }
  }

  for (const [key, surface] of Object.entries(spec.surfaces)) {
    for (const { row, label } of CHECKLIST_ROWS) {
      const answer = surface.checklist[row]
      if (answer.state) continue
      const id = surfaceId(spec.slug, key)
      if (answer.review && new Date(answer.review) <= now) {
        findings.push({
          kind: "waiver-due",
          id,
          detail: `${label}: "${answer.waived}" was due for review on ${answer.review}. Re-read it, and believe it or build the state.`,
        })
      }
      if (options.requireWitness && !answer.witness) {
        findings.push({
          kind: "waiver-unwitnessed",
          id,
          detail: `${label}: "${answer.waived}" names no RULE- or INV- that would go red if it stopped holding.`,
        })
      }
    }
  }

  for (const flow of spec.flows) {
    if (flow.spine.length === 0) {
      findings.push({
        kind: "empty-spine",
        id: flow.id,
        detail: "A flow with no steps walks nowhere.",
      })
      continue
    }
    flow.spine.forEach((step, i) => {
      const last = i === flow.spine.length - 1
      if (!last && step.end) {
        findings.push({
          kind: "spine-ends-early",
          id: flow.id,
          detail: `Step ${i + 1} ("${step.case}") ends, but ${flow.spine.length - i - 1} more step(s) follow it. Nothing connects them.`,
        })
      }
      if (last && step.on) {
        findings.push({
          kind: "spine-ends-early",
          id: flow.id,
          detail: `The last step ("${step.case}") says on: "${step.on}" but there is no next step. Say what the person is left with.`,
        })
      }
    })

    const spineCases = new Set(flow.spine.map((step) => step.case))
    const deviationCases = new Set(flow.deviations.map((d) => d.case))
    const spineSurfaces = new Set(
      flow.spine
        .map((step) => resolveSurface(spec, step.case))
        .filter((s): s is string => !!s)
    )
    const strayed = new Map<string, number>()

    for (const deviation of flow.deviations) {
      if (!spineCases.has(deviation.from)) {
        findings.push(
          deviationCases.has(deviation.from)
            ? {
                kind: "deviation-off-deviation",
                id: flow.id,
                detail: `"${deviation.case}" branches off "${deviation.from}", which is itself a deviation.`,
              }
            : {
                kind: "dangling-deviation",
                id: flow.id,
                detail: `"${deviation.case}" branches off "${deviation.from}", which is not a step on this flow.`,
              }
        )
      }
      if (deviation.rejoins && !spineCases.has(deviation.rejoins)) {
        findings.push({
          kind: "dangling-deviation",
          id: flow.id,
          detail: `"${deviation.case}" rejoins at "${deviation.rejoins}", which is not a step on this flow.`,
        })
      }
      const surface = resolveSurface(spec, deviation.case)
      if (surface && !spineSurfaces.has(surface)) {
        strayed.set(surface, (strayed.get(surface) ?? 0) + 1)
      }
    }

    for (const [surface, count] of strayed) {
      if (count < 2) continue
      findings.push({
        kind: "compound-actor",
        id: flow.id,
        detail: `Deviates ${count} times into "${surface}", a surface its own spine never visits. This flow has probably swallowed another actor's path.`,
      })
    }
  }

  return sortFindings(findings)
}
