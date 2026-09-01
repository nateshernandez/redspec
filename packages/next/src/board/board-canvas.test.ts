import { describe, expect, it } from "vitest"
import type { Board } from "@redspec/core/client"
import { toFlowEdges, toFlowNodes } from "./board-canvas"

/**
 * The board draws its connectors from React Flow's handle bounds, and React
 * Flow keeps a node's measured internals only while the node object it was
 * handed stays referentially identical (`adoptUserNodes` short-circuits on
 * `userNode === internals.userNode`). Rebuild the node objects and
 * `parseHandles` returns undefined for a node carrying neither `handles` nor
 * `measured` -- every edge then resolves to a null position and renders
 * nothing, with no resize to recover from because no box changed size.
 *
 * So the node list must not be a function of focus. These two builders are
 * separate for that reason alone, and the split is what these tests hold.
 */
const board: Board = {
  nodes: [
    {
      id: "a",
      type: "spec",
      position: { x: 0, y: 0 },
      width: 10,
      height: 10,
      data: { label: "A" },
    },
    {
      id: "b",
      type: "spec",
      position: { x: 40, y: 0 },
      width: 10,
      height: 10,
      data: { label: "B" },
    },
    {
      id: "c",
      type: "spec",
      position: { x: 80, y: 0 },
      width: 10,
      height: 10,
      data: { label: "C" },
    },
  ],
  edges: [
    { id: "a->b", source: "a", target: "b", label: "next", kind: "spine" },
    { id: "b->c", source: "b", target: "c", label: "then", kind: "deviation" },
  ],
} as unknown as Board

describe("what the board hands React Flow", () => {
  it("cannot see what is focused, so hovering cannot rebuild the nodes", () => {
    // The guard is the signature, not the output: focus takes (board, route)
    // and nothing else, so no caller can make the node list vary with the
    // pointer. Fold these two builders back into one that also takes focus and
    // this arity changes -- which is the mistake that blanked the connectors.
    expect(toFlowNodes).toHaveLength(2)
    expect(toFlowNodes(board, "/spec").map((n) => n.id)).toEqual(["a", "b", "c"])
  })

  it("dims the edges off the focused path and lights the ones on it", () => {
    const lit = toFlowEdges(board, new Set(["a", "b"]))
    const onPath = lit.find((e) => e.id === "a->b")!
    const offPath = lit.find((e) => e.id === "b->c")!
    expect((onPath.style as { opacity: number }).opacity).toBe(1)
    expect((offPath.style as { opacity: number }).opacity).toBeLessThan(1)
  })

  it("lights everything when nothing is focused", () => {
    for (const e of toFlowEdges(board, null))
      expect((e.style as { opacity: number }).opacity).toBe(1)
  })

  it("anchors every edge to a handle the node renders", () => {
    // A source/target handle React Flow cannot resolve is the other way an
    // edge silently renders nothing.
    for (const e of toFlowEdges(board, null)) {
      expect(["right", "bottom"]).toContain(e.sourceHandle)
      expect(["left", "top"]).toContain(e.targetHandle)
    }
  })
})
