// Where every node on the board goes.
//
// Positions are derived here and never authored. A hand-placed board is a file
// nobody reviews and it goes stale on the first new state, so the board is
// read-only and this module is the only thing that decides geometry.
//
// The spine is *placed* rather than ranked: it is an ordered array, so its
// geometry is arithmetic -- `x = i * PITCH` along one fixed `y`. Deviations
// hang in a band beneath the step they branch from, so a rejoin is an arrow
// travelling back to the line -- which is what it means.
//
// Nodes come from the *union* of the rendered cases and every ID the surfaces
// and flows name. Deriving them from `cases` alone renders an empty canvas for
// a skeleton, which is the one moment the board most needs to be legible.

import { declaredStateIds, resolveChecklistRow, resolveSurface } from "./audit"
import { CHECKLIST_ROWS, rowLabel } from "./checklist"
import type { Spec } from "./types"

/** The framed case is 1280×720 at half scale: the screenshot tier's viewport. */
export const NODE_W = 640
/** The 44px title bar plus the 640×360 frame the case is drawn at. */
export const NODE_H = 404
export const NODE_HEADER_H = 44
export const CASE_VIEWPORT_W = 1280
export const CASE_VIEWPORT_H = 720

const SPINE_GAP = 440
const PITCH = NODE_W + SPINE_GAP
const LANE_HEADER_H = 120
const DEVIATION_GAP = 280
const DEVIATION_PITCH = NODE_H + 100
const LANE_GAP = 220

const SURFACE_COLUMNS = 4
const SURFACE_COL_PITCH = NODE_W + 60
const SURFACE_ROW_PITCH = NODE_H + 140
const SURFACE_BLOCK_GAP = 200

export type BoardNodeData = {
  kind: "case" | "stub" | "waiver" | "lane"
  stateId?: string
  feature?: string
  title?: string
  surface?: string
  checklistRow?: string
  waiver?: string
  witness?: string
  review?: string
  endsWith?: string
  label?: string
  sublabel?: string
  tone?: "default" | "alarm"
}

export type BoardNode = {
  id: string
  type: "spec" | "lane"
  position: { x: number; y: number }
  width: number
  height: number
  data: BoardNodeData
}

export type BoardEdge = {
  id: string
  source: string
  target: string
  label?: string
  kind: "spine" | "deviation" | "rejoin"
}

export type Board = { nodes: BoardNode[]; edges: BoardEdge[] }

function stateNode(
  spec: Spec,
  id: string,
  nodeId: string,
  x: number,
  y: number,
  extra: Partial<BoardNodeData> = {}
): BoardNode {
  const entry = spec.cases[id]
  const surfaceKey = resolveSurface(spec, id)
  const row = resolveChecklistRow(spec, id)
  return {
    id: nodeId,
    type: "spec",
    position: { x, y },
    width: NODE_W,
    height: NODE_H,
    data: {
      kind: entry ? "case" : "stub",
      stateId: id,
      feature: spec.slug,
      title: entry?.title ?? id,
      surface: surfaceKey ? spec.surfaces[surfaceKey]!.title : "No surface",
      checklistRow: row ? rowLabel(row) : undefined,
      ...extra,
    },
  }
}

function laneNode(
  id: string,
  y: number,
  label: string,
  sublabel: string,
  tone: BoardNodeData["tone"] = "default"
): BoardNode {
  return {
    id,
    type: "lane",
    position: { x: 0, y },
    width: NODE_W,
    height: LANE_HEADER_H,
    data: { kind: "lane", label, sublabel, tone },
  }
}

/** One lane per flow: the spine left to right, deviations in a band beneath. */
export function flowsBoard(spec: Spec): Board {
  const nodes: BoardNode[] = []
  const edges: BoardEdge[] = []
  const reached = new Set<string>()
  let top = 0

  for (const flow of spec.flows) {
    nodes.push(laneNode(`lane:${flow.id}`, top, flow.title, `${flow.actor} · ${flow.id}`))
    const laneTop = top + LANE_HEADER_H
    const stepNodeId = (i: number) => `${flow.id}:${i}:${flow.spine[i]!.case}`
    const firstStepFor = new Map<string, string>()

    flow.spine.forEach((step, i) => {
      reached.add(step.case)
      if (!firstStepFor.has(step.case)) firstStepFor.set(step.case, stepNodeId(i))
      nodes.push(
        stateNode(
          spec,
          step.case,
          stepNodeId(i),
          i * PITCH,
          laneTop,
          step.end ? { endsWith: step.end } : {}
        )
      )
      if (flow.spine[i + 1] && step.on) {
        edges.push({
          id: `${flow.id}:spine:${i}`,
          source: stepNodeId(i),
          target: stepNodeId(i + 1),
          label: step.on,
          kind: "spine",
        })
      }
    })

    // Deviations stack under the step they branch from. A dangling one -- its
    // `from` is on no step -- is parked in its own column to the left of the
    // lane, with its own counter, so the audit's report has something on the
    // board to point at and the lane's height is not inflated by its index.
    const perStep = new Map<string, number>()
    let danglingCount = 0
    let deepest = 0

    flow.deviations.forEach((deviation, index) => {
      const stepIndex = flow.spine.findIndex((s) => s.case === deviation.from)
      const dangling = stepIndex === -1
      const row = dangling ? danglingCount++ : (perStep.get(deviation.from) ?? 0)
      if (!dangling) perStep.set(deviation.from, row + 1)
      deepest = Math.max(deepest, row + 1)

      const x = (dangling ? -1 : stepIndex) * PITCH + 120
      const y = laneTop + NODE_H + DEVIATION_GAP + row * DEVIATION_PITCH
      const nodeId = `${flow.id}:dev:${index}`

      reached.add(deviation.case)
      nodes.push(
        stateNode(spec, deviation.case, nodeId, x, y, {
          endsWith: deviation.end,
          tone: dangling ? "alarm" : "default",
        })
      )
      const from = firstStepFor.get(deviation.from)
      if (from) {
        edges.push({
          id: `${nodeId}:in`,
          source: from,
          target: nodeId,
          label: deviation.when,
          kind: "deviation",
        })
      }
      const rejoins = deviation.rejoins ? firstStepFor.get(deviation.rejoins) : undefined
      if (rejoins) {
        edges.push({
          id: `${nodeId}:out`,
          source: nodeId,
          target: rejoins,
          kind: "rejoin",
        })
      }
    })

    top =
      laneTop +
      NODE_H +
      (deepest > 0 ? DEVIATION_GAP + deepest * DEVIATION_PITCH : 0) +
      LANE_GAP
  }

  const stray = declaredStateIds(spec).filter((id) => !reached.has(id))
  if (stray.length > 0) {
    nodes.push(
      laneNode(
        "lane:off-path",
        top,
        "Not on any path",
        `${stray.length} declared, nothing reaches them`,
        "alarm"
      )
    )
    stray.forEach((id, i) => {
      nodes.push(
        stateNode(spec, id, `off:${id}`, i * PITCH, top + LANE_HEADER_H, {
          tone: "alarm",
        })
      )
    })
  }

  return { nodes, edges }
}

/** The same states regrouped by screen, twelve rows each, in a fixed grid. */
export function surfacesBoard(spec: Spec): Board {
  const nodes: BoardNode[] = []
  let top = 0

  for (const [key, surface] of Object.entries(spec.surfaces)) {
    const answered = CHECKLIST_ROWS.filter(
      ({ row }) => surface.checklist[row].state
    ).length
    nodes.push(
      laneNode(
        `lane:${key}`,
        top,
        surface.title,
        `${answered} of ${CHECKLIST_ROWS.length} rows declare a state`
      )
    )

    CHECKLIST_ROWS.forEach(({ row, label }, i) => {
      const x = (i % SURFACE_COLUMNS) * SURFACE_COL_PITCH
      const y = top + LANE_HEADER_H + Math.floor(i / SURFACE_COLUMNS) * SURFACE_ROW_PITCH
      const answer = surface.checklist[row]

      if (answer.state) {
        nodes.push(
          stateNode(spec, answer.state, `${key}:${row}`, x, y, { checklistRow: label })
        )
        return
      }
      nodes.push({
        id: `${key}:${row}`,
        type: "spec",
        position: { x, y },
        width: NODE_W,
        height: NODE_H,
        data: {
          kind: "waiver",
          checklistRow: label,
          surface: surface.title,
          waiver: answer.waived,
          witness: answer.witness,
          review: answer.review,
        },
      })
    })

    const rows = Math.ceil(CHECKLIST_ROWS.length / SURFACE_COLUMNS)
    top += LANE_HEADER_H + rows * SURFACE_ROW_PITCH + SURFACE_BLOCK_GAP
  }

  return { nodes, edges: [] }
}
