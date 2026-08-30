"use client"

// The board: every state of one feature, laid out along the paths it is reached
// by, on a canvas the reviewer pans and zooms.
//
// A node frames the *live* case route in an iframe rather than re-rendering the
// case here, so the board and the screenshot baselines cannot show different
// things. Above ~0.35 zoom that frame is what you read; below it the node falls
// back to a compact chip -- which is also what stops every case mounting an
// iframe at once, and the only form a stub ever takes.

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./board.css"
import { useState } from "react"
import {
  CASE_VIEWPORT_H,
  CASE_VIEWPORT_W,
  NODE_HEADER_H,
  NODE_W,
  type Board,
  type BoardNodeData,
} from "@redspec/core"

const FRAME_ABOVE_ZOOM = 0.35
const VIEWS = ["flows", "surfaces"] as const
type View = (typeof VIEWS)[number]

type SpecNode = Node<BoardNodeData & { route: string }, "spec">
type LaneNode = Node<BoardNodeData, "lane">

function Chip({ data }: { data: BoardNodeData }) {
  const stub = data.kind === "stub"
  return (
    <div className={`rs-chip ${stub ? "rs-chip-stub" : ""}`}>
      <p className="rs-chip-id">{data.stateId}</p>
      <p className="rs-chip-sub">
        {data.surface}
        {data.checklistRow ? ` · ${data.checklistRow}` : ""}
      </p>
      {stub && <p className="rs-chip-note">Declared — not yet rendered</p>}
    </div>
  )
}

function Waiver({ data }: { data: BoardNodeData }) {
  return (
    <div className="rs-waiver">
      <p className="rs-waiver-row">{data.checklistRow}</p>
      <p className="rs-waiver-reason">{data.waiver}</p>
      {(data.witness || data.review) && (
        <p className="rs-waiver-meta">
          {data.witness ? `witness: ${data.witness}` : `review by ${data.review}`}
        </p>
      )}
    </div>
  )
}

function SpecNodeView({ data }: NodeProps<SpecNode>) {
  const zoom = useStore((s) => s.transform[2])
  if (data.kind === "waiver") return <Waiver data={data} />
  const framed = data.kind === "case" && zoom >= FRAME_ABOVE_ZOOM
  const scale = NODE_W / CASE_VIEWPORT_W
  return (
    <div className={`rs-node ${data.tone === "alarm" ? "rs-alarm" : ""}`}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      {framed ? (
        <div className="rs-frame">
          <div className="rs-frame-header" style={{ height: NODE_HEADER_H }}>
            <span className="rs-mono">{data.stateId}</span>
            <span className="rs-muted">{data.checklistRow ?? data.surface}</span>
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
        </div>
      ) : (
        <Chip data={data} />
      )}
      {data.endsWith && (
        <div className="rs-ends">
          <strong>Ends here. </strong>
          {data.endsWith}
        </div>
      )}
    </div>
  )
}

function LaneNodeView({ data }: NodeProps<LaneNode>) {
  const zoom = useStore((s) => s.transform[2])
  return (
    <div className="rs-lane">
      <div
        style={{
          transform: `scale(${1 / zoom})`,
          transformOrigin: "bottom left",
          whiteSpace: "nowrap",
        }}
      >
        <p className={`rs-lane-title ${data.tone === "alarm" ? "rs-alarm-text" : ""}`}>
          {data.label}
        </p>
        <p className="rs-muted rs-lane-sub">{data.sublabel}</p>
      </div>
    </div>
  )
}

const nodeTypes = { spec: SpecNodeView, lane: LaneNodeView }

const EDGE_STYLE = {
  spine: { stroke: "var(--rs-fg)", strokeWidth: 4 },
  deviation: { stroke: "var(--rs-muted)", strokeWidth: 3, strokeDasharray: "10 8" },
  rejoin: { stroke: "var(--rs-muted)", strokeWidth: 3, strokeDasharray: "2 10" },
} as const
const HANDLES = {
  spine: { sourceHandle: "right", targetHandle: "left" },
  deviation: { sourceHandle: "bottom", targetHandle: "top" },
  rejoin: { sourceHandle: "right", targetHandle: "top" },
} as const

function toFlow(
  { nodes, edges }: Board,
  route: string
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
      selectable: false,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      ...HANDLES[e.kind],
      style: EDGE_STYLE[e.kind],
      labelShowBg: true,
      labelBgPadding: [10, 6] as [number, number],
      labelBgBorderRadius: 6,
      labelStyle: { fontSize: 18 },
    })),
  }
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
  const graph = toFlow(view === "flows" ? flows : surfaces, route)
  return (
    <div className="rs-canvas">
      <ReactFlow
        key={view}
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.05}
        maxZoom={1.5}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap pannable zoomable />
        <Panel position="top-right">
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
      </ReactFlow>
    </div>
  )
}
