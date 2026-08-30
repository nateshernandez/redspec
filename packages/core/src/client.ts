// The client-safe surface: everything a browser bundle or a "use client"
// component may import. Nothing re-exported here reaches node:fs, node:crypto,
// or jiti -- importing the full barrel from the board is what dragged the jiti
// loader into an app-client chunk and 500'd the spec route. The node-only half
// lives in index.ts.
export * from "./types"
export * from "./checklist"
export * from "./findings"
export * from "./brief"
export * from "./audit"
export * from "./graph"
export * from "./decision-table"
export * from "./board-layout"
export * from "./config"
