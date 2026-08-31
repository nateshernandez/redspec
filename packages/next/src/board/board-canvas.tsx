"use client"

// The board: every state of one feature, laid out along the paths it is reached
// by, on a canvas the reviewer pans and zooms.
//
// Three things carry the meaning, and each is drawn once. A node says what the
// person is *looking at* -- the declared name, in a sentence -- and colours
// itself by which kind of moment its checklist row is. An arrow says what the
// person *did*, with a head on it, so the direction of a branch and the
// direction of a rejoin are not left to convention. The lane band says whose
// journey this is, and keeps saying it while you pan.
//
// Nothing is printed twice: the edge label is the When, so no node repeats it,
// and the row's gloss is the question the *surfaces* view exists to answer, so
// only that view asks it.
//
// Zoom is the level of detail, deliberately. Far out the node is a pill and you
// read the shape of the feature; in the middle it is a named card; close in it
// frames the live case route in an iframe, so the board and the screenshot
// baselines cannot show different things.

import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Handle,
  MarkerType,
  MiniMap,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { createContext, useContext, useMemo, useState } from "react"
import {
  CASE_VIEWPORT_H,
  CASE_VIEWPORT_W,
  LANE_HEADER_H,
  NODE_HEADER_H,
  NODE_W,
  type Board,
  type BoardEdge,
  type BoardNodeData,
} from "@redspec/core/client"

// The tier boundaries are set by what is *readable* at each, not by round
// numbers. A node is 640 units wide: at 0.34 that is 218px on screen, where the
// pill's 58-unit row label lands at 20px and the card's 30-unit name would land
// at 10px. So the pill holds until the card can be read, not until it runs out
// of things to say.
/** Below this a node is a pill: the tier for reading the whole feature at once. */
const MAP_BELOW_ZOOM = 0.34
/** At and above this a case frames its live route. */
const FRAME_ABOVE_ZOOM = 0.55

const VIEWS = ["flows", "surfaces"] as const
type View = (typeof VIEWS)[number]

type SpecNode = Node<BoardNodeData & { route: string }, "spec">
type LaneNode = Node<BoardNodeData, "lane">

const EDGE_KINDS: { kind: BoardEdge["kind"]; label: string; hint: string }[] = [
  { kind: "spine", label: "Spine", hint: "the happy path, in order" },
  { kind: "deviation", label: "Branch", hint: "leaves the path here" },
  { kind: "rejoin", label: "Rejoin", hint: "returns to the path" },
]

const FAMILIES: { family: NonNullable<BoardNodeData["family"]>; label: string }[] = [
  { family: "settled", label: "At rest" },
  { family: "transient", label: "Waiting" },
  { family: "error", label: "Gone wrong" },
  { family: "blocked", label: "Blocked" },
  { family: "done", label: "Finished" },
]

const familyVar = (data: BoardNodeData) => `var(--rs-fam-${data.family ?? "settled"})`

/**
 * What is lit right now. Held beside the graph rather than inside each node's
 * `data`, so hovering re-renders the nodes without rebuilding every node object
 * -- which is what would drop the iframes and reload every framed case.
 */
type Focus = { focus: Set<string> | null; focusLane: string | null }
const FocusContext = createContext<Focus>({ focus: null, focusLane: null })

/** The ID, small and copyable, where it belongs: a reference, not a headline. */
function StateId({ id }: { id?: string }) {
  if (!id) return null
  return <span className="rs-id">{id}</span>
}

/**
 * Far out, where a node is 100px wide on screen and a sentence is 3px tall.
 * A name cannot be read here, so the pill does not try: it says which screen
 * and which of the twelve, which is short enough to survive the scale and is
 * exactly what "where am I" means at this zoom. The name is one zoom step in.
 */
function Pill({ data }: { data: BoardNodeData }) {
  return (
    <div
      className={`rs-pill ${data.kind === "stub" ? "rs-pill-stub" : ""}`}
      style={{ ["--rs-fam" as string]: familyVar(data) }}
    >
      <p className="rs-pill-where">{data.surface}</p>
      <p className="rs-pill-row">{data.checklistRow ?? "Off the checklist"}</p>
    </div>
  )
}

/**
 * Frame one journey at a time.
 *
 * `fitView` over four stacked lanes lands at 0.08, where nothing is legible --
 * and no amount of tightening the geometry fixes that, because a lane eight
 * steps long is wider than the screen at any zoom you would read a card at.
 * The unit a reviewer actually walks is one journey, so that is the unit the
 * viewport offers.
 */
function LanePicker({ lanes }: { lanes: { id: string; label: string }[] }) {
  const { fitView } = useReactFlow()
  if (lanes.length < 2) return null
  return (
    <div className="rs-lanes">
      <p className="rs-lanes-head">Frame</p>
      <button type="button" onClick={() => void fitView({ padding: 0.06 })}>
        Everything
      </button>
      {lanes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => void fitView({ nodes: [{ id }], padding: 0.04 })}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** The middle tier, and the header of the close one: what this state is. */
function CardHead({ data, compact }: { data: BoardNodeData; compact?: boolean }) {
  return (
    <div className={`rs-head ${compact ? "rs-head-compact" : ""}`}>
      <p className="rs-head-name">{data.name}</p>
      <p className="rs-head-meta">
        <span className="rs-head-row">{data.checklistRow ?? "Off the checklist"}</span>
        <span className="rs-head-sep">·</span>
        <span>{data.surface}</span>
        <StateId id={data.stateId} />
      </p>
    </div>
  )
}

function Waiver({ data }: { data: BoardNodeData }) {
  return (
    <div className="rs-waiver" style={{ ["--rs-fam" as string]: familyVar(data) }}>
      <p className="rs-waiver-row">{data.checklistRow}</p>
      {data.asks && <p className="rs-waiver-asks">{data.asks}</p>}
      <p className="rs-waiver-reason">{data.waiver}</p>
      {(data.witness || data.review) && (
        <p className="rs-waiver-meta">
          {data.witness ? `witness: ${data.witness}` : `review by ${data.review}`}
        </p>
      )}
    </div>
  )
}

function SpecNodeView({ data, id, selected }: NodeProps<SpecNode>) {
  const zoom = useStore((s) => s.transform[2])
  const { focus } = useContext(FocusContext)
  const dimmed = focus ? !focus.has(id) : false
  if (data.kind === "waiver") {
    return (
      <div className={`rs-node ${dimmed ? "rs-dim" : ""}`}>
        <Waiver data={data} />
      </div>
    )
  }
  const framed = data.kind === "case" && zoom >= FRAME_ABOVE_ZOOM
  const scale = NODE_W / CASE_VIEWPORT_W
  return (
    <div
      className={`rs-node ${data.tone === "alarm" ? "rs-alarm" : ""} ${
        dimmed ? "rs-dim" : ""
      } ${selected ? "rs-picked" : ""}`}
      style={{ ["--rs-fam" as string]: familyVar(data) }}
    >
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      {/* The proof, on demand: only what a reviewer asks a specific node for. */}
      <NodeToolbar isVisible={selected} position={Position.Right} offset={24}>
        <div className="rs-toolbar">
          <p className="rs-toolbar-name">{data.name}</p>
          <StateId id={data.stateId} />
          {data.assertion ? (
            <p className="rs-toolbar-line">
              <strong>Asserts</strong> {data.assertion}
            </p>
          ) : (
            <p className="rs-toolbar-line rs-muted">
              No assertion yet — /render-states writes it.
            </p>
          )}
          {data.endsWith && (
            <p className="rs-toolbar-line">
              <strong>Ends here</strong> {data.endsWith}
            </p>
          )}
        </div>
      </NodeToolbar>

      {zoom < MAP_BELOW_ZOOM ? (
        <Pill data={data} />
      ) : (
        <div className={`rs-card ${data.kind === "stub" ? "rs-card-stub" : ""}`}>
          {framed ? (
            <>
              <div style={{ height: NODE_HEADER_H }}>
                <CardHead data={data} compact />
              </div>
              <div className="rs-frame-body">
                <iframe
                  src={`${data.route}/${data.feature}/${data.stateId}`}
                  title={data.stateId}
                  width={CASE_VIEWPORT_W}
                  height={CASE_VIEWPORT_H}
                  style={{ transform: `scale(${scale})` }}
                />
              </div>
            </>
          ) : (
            <>
              <CardHead data={data} />
              {data.kind === "stub" && (
                <p className="rs-card-note">Declared — not yet rendered</p>
              )}
            </>
          )}
        </div>
      )}

      {data.endsWith && (
        <div className="rs-below">
          <div className="rs-ends">
            <strong>Ends here. </strong>
            {data.endsWith}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The lane's band, and its title pinned to whichever edge of it you are
 * looking at. A journey's name that only exists at x=0 stops answering the
 * question the moment you pan past its third step.
 */
function LaneNodeView({ data, positionAbsoluteX, width }: NodeProps<LaneNode>) {
  const zoom = useStore((s) => s.transform[2])
  const tx = useStore((s) => s.transform[0])
  const { focusLane } = useContext(FocusContext)
  const dimmed = focusLane !== null && focusLane !== data.flowId
  // Zoomed all the way out the lanes are closer together on screen than a
  // constant-size chip is tall, so the chip stops growing and drops its second
  // line -- at that zoom the question is only "which journey", not "how big".
  const k = Math.min(1 / zoom, 9)
  const terse = zoom < 0.13
  // Where the viewport's left edge falls inside this band, in flow units.
  const viewportLeft = -tx / zoom
  const slack = Math.max(0, (width ?? 0) - 900)
  const offset = Math.min(Math.max(0, viewportLeft - positionAbsoluteX + 24), slack)
  return (
    <div
      className={`rs-lane ${data.tone === "alarm" ? "rs-lane-alarm" : ""} ${dimmed ? "rs-dim" : ""}`}
    >
      {/* The label is drawn at constant screen size, so as you zoom out it grows
          *upward* out of the lane's header -- into the gap above the band,
          never down over the first row of states. */}
      <div className="rs-lane-header" style={{ height: LANE_HEADER_H }}>
        <div
          className="rs-lane-label"
          style={{
            transform: `translateX(${offset}px) scale(${k})`,
            transformOrigin: "bottom left",
          }}
        >
          <p className={`rs-lane-title ${data.tone === "alarm" ? "rs-alarm-text" : ""}`}>
            {data.label}
          </p>
          {!terse && <p className="rs-muted rs-lane-sub">{data.sublabel}</p>}
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { spec: SpecNodeView, lane: LaneNodeView }

/**
 * The step's label, centred in the gap between two nodes.
 *
 * React Flow's built-in label is one SVG `<text>`: it cannot wrap, so a label
 * like "Clerk accepts the code, then transfers the verified attempt into a new
 * account" runs straight across both nodes it connects. Rendered as HTML it
 * wraps inside the gap the layout reserved for it -- which is why SPINE_GAP is
 * sized by the label rather than the label truncated to fit the gap.
 */
function SpineEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="rs-edge-label rs-edge-spine"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/**
 * A branch's label, sitting on top of the state it leads to.
 *
 * Not the midpoint: a branch that drops two rows has its midpoint *inside* the
 * node in the row between. Not the source either, because every branch off one
 * step shares a source and they would all be written in the same place. Each
 * deviation has a row to itself, and DEVIATION_GAP reserves the band above it,
 * so anchoring to the target is the one placement that cannot collide.
 */
function BranchEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 24,
  })
  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="rs-edge-label rs-edge-branch"
            style={{
              transform: `translate(-50%, -100%) translate(${targetX}px, ${targetY - 22}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

function RejoinEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath({ ...props, borderRadius: 24 })
  return <BaseEdge path={path} style={props.style} markerEnd={props.markerEnd} />
}

const edgeTypes = { spine: SpineEdge, deviation: BranchEdge, rejoin: RejoinEdge }

// Widths and dashes are in *screen* pixels: board.css gives every edge path
// `vector-effect: non-scaling-stroke`, because a 5-unit stroke is 0.4px at the
// zoom where you read the shape of a feature, and an arrow you cannot see is
// the one thing this board cannot afford to lose.
const EDGE_STYLE = {
  spine: { stroke: "var(--rs-spine)", strokeWidth: 4 },
  deviation: { stroke: "var(--rs-branch)", strokeWidth: 3, strokeDasharray: "7 5" },
  rejoin: { stroke: "var(--rs-rejoin)", strokeWidth: 2.5, strokeDasharray: "2 7" },
} as const

const HANDLES = {
  spine: { sourceHandle: "right", targetHandle: "left" },
  deviation: { sourceHandle: "bottom", targetHandle: "top" },
  rejoin: { sourceHandle: "right", targetHandle: "top" },
} as const

function toFlow(
  { nodes, edges }: Board,
  route: string,
  focus: Set<string> | null
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      width: n.width,
      height: n.height,
      data: { ...n.data, route },
      draggable: false,
      // A lane is scenery: it sits behind the edges and cannot be picked.
      selectable: n.type === "spec",
      zIndex: n.type === "lane" ? -1 : 0,
      className: n.type === "lane" ? "rs-lane-node" : undefined,
    })),
    edges: edges.map((e) => {
      const lit = !focus || (focus.has(e.source) && focus.has(e.target))
      const stroke = EDGE_STYLE[e.kind].stroke
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: e.kind,
        ...HANDLES[e.kind],
        style: { ...EDGE_STYLE[e.kind], opacity: lit ? 1 : 0.12 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: stroke,
        },
        zIndex: lit ? 1 : 0,
      }
    }),
  }
}

/** Everything up- and downstream of one node: the path it is on, both ways. */
function pathThrough(edges: Board["edges"], start: string): Set<string> {
  const out = new Map<string, string[]>()
  const back = new Map<string, string[]>()
  for (const e of edges) {
    out.set(e.source, [...(out.get(e.source) ?? []), e.target])
    back.set(e.target, [...(back.get(e.target) ?? []), e.source])
  }
  const seen = new Set<string>([start])
  for (const map of [out, back]) {
    const queue = [start]
    while (queue.length) {
      const at = queue.shift()!
      for (const next of map.get(at) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

export function SpecBoardCanvas({
  flows,
  surfaces,
  route,
}: {
  flows: Board
  surfaces: Board
  route: string
}) {
  const [view, setView] = useState<View>("flows")
  const [pinned, setPinned] = useState<string | null>(null)
  const [legend, setLegend] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const board = view === "flows" ? flows : surfaces
  const active = pinned ?? hovered

  const focus = useMemo(
    () => (active ? pathThrough(board.edges, active) : null),
    [board, active]
  )
  const focusLane = useMemo(() => {
    if (!active) return null
    return board.nodes.find((n) => n.id === active)?.data.flowId ?? null
  }, [board, active])

  const graph = useMemo(() => toFlow(board, route, focus), [board, route, focus])
  const lanes = useMemo(
    () =>
      board.nodes
        .filter((n) => n.type === "lane")
        .map((n) => ({ id: n.id, label: n.data.label ?? n.id })),
    [board]
  )
  const focusValue = useMemo(() => ({ focus, focusLane }), [focus, focusLane])

  return (
    <div className="rs-canvas">
      <FocusContext.Provider value={focusValue}>
        <ReactFlow
          key={view}
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.06 }}
          // Low enough that fitView can always fit: a feature with a dozen states
          // per flow is taller than the viewport at any zoom a reader would pick.
          minZoom={0.01}
          maxZoom={1.5}
          onNodeMouseEnter={(_, n) => setHovered(n.type === "spec" ? n.id : null)}
          onNodeMouseLeave={() => setHovered(null)}
          onNodeClick={(_, n) =>
            setPinned((p) => (n.type !== "spec" ? p : p === n.id ? null : n.id))
          }
          onPaneClick={() => setPinned(null)}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls position="top-left" showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) =>
              n.type === "lane"
                ? "var(--rs-border-soft)"
                : `var(--rs-fam-${(n.data as BoardNodeData).family ?? "settled"})`
            }
          />
          <Panel position="top-right">
            <LanePicker lanes={lanes} />
            <div className="rs-toggle" role="group" aria-label="Board view">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  className={view === v ? "rs-on" : ""}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </Panel>
          <Panel position="bottom-left">
            <div className={`rs-legend ${legend ? "" : "rs-legend-shut"}`}>
              <button
                type="button"
                className="rs-legend-toggle"
                aria-expanded={legend}
                onClick={() => setLegend((v) => !v)}
              >
                {legend ? "Hide key" : "Key"}
              </button>
              {view === "flows" && legend && (
                <div className="rs-legend-block">
                  {EDGE_KINDS.map(({ kind, label, hint }) => (
                    <div key={kind} className="rs-legend-row">
                      <span className={`rs-legend-line rs-legend-${kind}`} />
                      <span className="rs-legend-label">{label}</span>
                      <span className="rs-muted">{hint}</span>
                    </div>
                  ))}
                </div>
              )}
              {legend && (
                <div className="rs-legend-block">
                  {FAMILIES.map(({ family, label }) => (
                    <div key={family} className="rs-legend-row">
                      <span
                        className="rs-legend-dot"
                        style={{ background: `var(--rs-fam-${family})` }}
                      />
                      <span className="rs-legend-label">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {legend && (
                <p className="rs-legend-hint rs-muted">
                  Hover a state to light its path · click to pin it and read its detail
                </p>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </FocusContext.Provider>
    </div>
  )
}
