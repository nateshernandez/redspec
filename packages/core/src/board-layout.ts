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
//
// Geometry is set by what a node *says*, and a node says its name inside its
// own card. Everything that used to hang underneath -- a Given that was the
// same constant on every board ever drawn, a When that was the arrow's label
// printed a second time -- is gone, and with it the 360px every node had to
// reserve for it. What is left below a node is the one thing only that node
// knows: what the person is left with when the path ends there.

import { declaredStateIds, resolveChecklistRow, resolveSurface } from "./audit"
import { CHECKLIST_ROWS, rowAsks, rowFamily, rowLabel } from "./checklist"
import type { ChecklistFamily } from "./checklist"
import { stateName } from "./types"
import type { Flow, Spec } from "./types"

/**
 * What the board knows beyond the registry.
 *
 * Both fields are read off artifacts that are already in the lock -- the
 * assertion is part of a state's digest, a resolution table is part of a
 * rule's -- so drawing them adds no prose anybody can edit without `check`
 * noticing. That is the bar for anything the board puts in front of a
 * reviewer: if signing off on it is the point, it has to be digested.
 */
export type BoardContext = {
  /** State ID → the intent sentence its assertion is named for. */
  assertions?: Record<string, string>
  /** States a resolution table routes to, reached without being on a flow. */
  resolvedStates?: ReadonlySet<string>
}

/** The framed case is 1280×720 at half scale: the screenshot tier's viewport. */
export const NODE_W = 640
/** Two lines of name plus the meta line, above the 640×360 frame. */
export const NODE_HEADER_H = 104
export const NODE_H = NODE_HEADER_H + 360
export const CASE_VIEWPORT_W = 1280
export const CASE_VIEWPORT_H = 720

/**
 * What a node draws *below* its box: the terminal note, and nothing else. It
 * is clamped to two lines in board.css, so this is a real ceiling rather than
 * an estimate -- and the layout has to reserve it, because a node whose words
 * are not in the geometry lands on the node underneath it. Change one of these
 * and change the other.
 */
export const NODE_BELOW_H = 132

// Wide enough for the step's label to sit between two nodes without touching
// either. The label is the *only* place the "When" is written now, so the gap
// is sized by it rather than the other way round.
const SPINE_GAP = 400
const PITCH = NODE_W + SPINE_GAP
export const LANE_HEADER_H = 96
// Room under a node for its terminal note, and then a clear band above each
// deviation for the label of the edge that reaches it. Every deviation is on
// its own row, so anchoring the label there is what keeps two branches off the
// same step from writing on top of each other.
const DEVIATION_GAP = NODE_BELOW_H + 170
const DEVIATION_PITCH = NODE_H + NODE_BELOW_H + 170
const LANE_GAP = NODE_BELOW_H + 140
/** Breathing room drawn around a lane's contents by its band. */
const LANE_PAD = 48

const SURFACE_COLUMNS = 4
const SURFACE_COL_PITCH = NODE_W + 60
const SURFACE_ROW_PITCH = NODE_H + NODE_BELOW_H + 60
const SURFACE_BLOCK_GAP = NODE_BELOW_H + 120

export type BoardNodeData = {
  kind: "case" | "stub" | "waiver" | "lane"
  stateId?: string
  feature?: string
  /** What the person is looking at, in the words the spec declares. */
  name?: string
  surface?: string
  checklistRow?: string
  /** The row's family, for the five-way colouring. */
  family?: ChecklistFamily
  /** The row as a situation, in the words the interview asked. Surfaces view. */
  asks?: string
  /** The intent its assertion is named for, once one exists. */
  assertion?: string
  waiver?: string
  witness?: string
  review?: string
  endsWith?: string
  label?: string
  sublabel?: string
  /** Lane only: the flow it heads, so its states can be dimmed together. */
  flowId?: string
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
  context: BoardContext,
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
      name: stateName(spec, id),
      surface: surfaceKey ? spec.surfaces[surfaceKey]!.title : "No surface",
      checklistRow: row ? rowLabel(row) : undefined,
      family: row ? rowFamily(row) : undefined,
      assertion: context.assertions?.[id],
      ...extra,
    },
  }
}

/**
 * The band behind a lane, sized to what it contains.
 *
 * A lane used to be a label floating at x=0, which answers "which journey is
 * this?" only while you are looking at the far left of it. A band is a shape
 * you are inside of, and the canvas keeps its title pinned to the viewport
 * edge, so the answer travels with you.
 */
function laneBand(
  id: string,
  contents: BoardNode[],
  top: number,
  label: string,
  sublabel: string,
  extra: Partial<BoardNodeData> = {}
): BoardNode {
  const left = contents.length
    ? Math.min(...contents.map((n) => n.position.x)) - LANE_PAD
    : 0
  const right = contents.length
    ? Math.max(...contents.map((n) => n.position.x + n.width)) + LANE_PAD
    : NODE_W
  const bottom = contents.length
    ? Math.max(...contents.map((n) => n.position.y + n.height + NODE_BELOW_H)) + LANE_PAD
    : top + LANE_HEADER_H
  return {
    id,
    type: "lane",
    position: { x: left, y: top },
    width: right - left,
    height: bottom - top,
    data: { kind: "lane", label, sublabel, tone: "default", ...extra },
  }
}

/** A journey's shape in one line, which is what the ID was standing in for. */
function flowShape(flow: Flow): string {
  const last = flow.spine[flow.spine.length - 1]
  const ends = flow.spine.length > 0 && last?.end ? last.end : null
  const parts = [
    `${flow.actor}`,
    `${flow.spine.length} step${flow.spine.length === 1 ? "" : "s"}`,
    `${flow.deviations.length} branch${flow.deviations.length === 1 ? "" : "es"}`,
  ]
  return ends ? `${parts.join(" · ")} · ends: ${ends}` : parts.join(" · ")
}

/** One lane per flow: the spine left to right, deviations in a band beneath. */
export function flowsBoard(spec: Spec, context: BoardContext = {}): Board {
  const nodes: BoardNode[] = []
  const edges: BoardEdge[] = []
  const reached = new Set<string>()
  let top = 0

  for (const flow of spec.flows) {
    const laneTop = top + LANE_HEADER_H
    const laneNodes: BoardNode[] = []
    const stepNodeId = (i: number) => `${flow.id}:${i}:${flow.spine[i]!.case}`
    const firstStepFor = new Map<string, string>()

    flow.spine.forEach((step, i) => {
      reached.add(step.case)
      if (!firstStepFor.has(step.case)) firstStepFor.set(step.case, stepNodeId(i))
      laneNodes.push(
        stateNode(spec, context, step.case, stepNodeId(i), i * PITCH, laneTop, {
          ...(step.end ? { endsWith: step.end } : {}),
          flowId: flow.id,
        })
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

    flow.deviations.forEach((deviation, index) => {
      const stepIndex = flow.spine.findIndex((s) => s.case === deviation.from)
      const dangling = stepIndex === -1
      const row = dangling ? danglingCount++ : (perStep.get(deviation.from) ?? 0)
      if (!dangling) perStep.set(deviation.from, row + 1)

      const x = (dangling ? -1 : stepIndex) * PITCH + 120
      const y = laneTop + NODE_H + DEVIATION_GAP + row * DEVIATION_PITCH
      const nodeId = `${flow.id}:dev:${index}`

      reached.add(deviation.case)
      laneNodes.push(
        stateNode(spec, context, deviation.case, nodeId, x, y, {
          endsWith: deviation.end,
          flowId: flow.id,
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

    nodes.push(
      laneBand(`lane:${flow.id}`, laneNodes, top, flow.title, flowShape(flow), {
        flowId: flow.id,
      }),
      ...laneNodes
    )
    top =
      (laneNodes.length
        ? Math.max(...laneNodes.map((n) => n.position.y + n.height + NODE_BELOW_H))
        : laneTop) +
      LANE_PAD +
      LANE_GAP
  }

  // A state no flow walks is stranded -- unless a resolution table routes to
  // it, which is a path to it that is not a path through it. Those get a lane
  // of their own rather than the red one, so the red lane keeps meaning
  // "nothing reaches this".
  const resolved = context.resolvedStates ?? new Set<string>()
  const unreached = declaredStateIds(spec).filter((id) => !reached.has(id))
  const byRule = unreached.filter((id) => resolved.has(id))
  const stray = unreached.filter((id) => !resolved.has(id))

  const extraLane = (
    id: string,
    prefix: string,
    ids: string[],
    label: string,
    sublabel: string,
    tone: BoardNodeData["tone"]
  ) => {
    const contents = ids.map((stateId, i) =>
      stateNode(
        spec,
        context,
        stateId,
        `${prefix}:${stateId}`,
        i * PITCH,
        top + LANE_HEADER_H,
        tone === "alarm" ? { tone } : {}
      )
    )
    nodes.push(
      laneBand(`lane:${id}`, contents, top, label, sublabel, { tone }),
      ...contents
    )
    top =
      Math.max(...contents.map((n) => n.position.y + n.height + NODE_BELOW_H)) +
      LANE_PAD +
      LANE_GAP
  }

  if (byRule.length > 0) {
    extraLane(
      "by-rule",
      "rule",
      byRule,
      "Reached by a rule",
      `${byRule.length} routed to by a resolution table, on no flow`,
      "default"
    )
  }
  if (stray.length > 0) {
    extraLane(
      "off-path",
      "off",
      stray,
      "Not on any path",
      `${stray.length} declared, nothing reaches them`,
      "alarm"
    )
  }

  return { nodes, edges }
}

/** The same states regrouped by screen, twelve rows each, in a fixed grid. */
export function surfacesBoard(spec: Spec, context: BoardContext = {}): Board {
  const nodes: BoardNode[] = []
  let top = 0

  for (const [key, surface] of Object.entries(spec.surfaces)) {
    const answered = CHECKLIST_ROWS.filter(
      ({ row }) => surface.checklist[row].state
    ).length
    const cells: BoardNode[] = []

    CHECKLIST_ROWS.forEach(({ row, label, asks, family }, i) => {
      const x = (i % SURFACE_COLUMNS) * SURFACE_COL_PITCH
      const y = top + LANE_HEADER_H + Math.floor(i / SURFACE_COLUMNS) * SURFACE_ROW_PITCH
      const answer = surface.checklist[row]

      if (answer.state) {
        cells.push(
          stateNode(spec, context, answer.state, `${key}:${row}`, x, y, {
            checklistRow: label,
            family,
            asks,
          })
        )
        return
      }
      cells.push({
        id: `${key}:${row}`,
        type: "spec",
        position: { x, y },
        width: NODE_W,
        height: NODE_H,
        data: {
          kind: "waiver",
          checklistRow: label,
          family,
          asks,
          surface: surface.title,
          waiver: answer.waived,
          witness: answer.witness,
          review: answer.review,
        },
      })
    })

    nodes.push(
      laneBand(
        `lane:${key}`,
        cells,
        top,
        surface.title,
        `${answered} of ${CHECKLIST_ROWS.length} rows declare a state · ${
          CHECKLIST_ROWS.length - answered
        } waived`
      ),
      ...cells
    )
    const rows = Math.ceil(CHECKLIST_ROWS.length / SURFACE_COLUMNS)
    top += LANE_HEADER_H + rows * SURFACE_ROW_PITCH + SURFACE_BLOCK_GAP
  }

  return { nodes, edges: [] }
}
