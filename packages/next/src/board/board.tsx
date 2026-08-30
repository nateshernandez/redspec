"use client"

import dynamic from "next/dynamic"
import type { Board } from "@redspec/core/client"

// Client-only: there is nothing in a pan-and-zoom canvas to serve early, and
// React Flow's minimap hydrates differently on the server.
const SpecBoardCanvas = dynamic(
  () => import("./board-canvas").then((m) => m.SpecBoardCanvas),
  {
    ssr: false,
    loading: () => <div style={{ height: "100%", width: "100%" }} />,
  }
)

export function SpecBoard(props: { flows: Board; surfaces: Board; route: string }) {
  return <SpecBoardCanvas {...props} />
}
