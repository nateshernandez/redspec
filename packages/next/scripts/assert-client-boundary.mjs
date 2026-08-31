// The board renders through `next/dynamic` with `ssr: false`, which Next only
// allows inside a Client Component. esbuild drops a "use client" directive off
// any module it inlines, so a build that bundles the board into the server
// entry produces a dist that typechecks, imports, and then 500s the /spec route
// at request time. That failure is invisible until a browser asks for the page,
// so assert the shape of the output here instead.
import { readFileSync } from "node:fs"

const failures = []

const board = readFileSync(new URL("../dist/board/board.js", import.meta.url), "utf8")
if (!/^\s*["']use client["']/.test(board)) {
  failures.push('dist/board/board.js lost its "use client" directive')
}

const index = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8")
if (index.includes("ssr: false")) {
  failures.push("dist/index.js inlined the board: `ssr: false` is in the server entry")
}
if (!index.includes('from "./board/board.js"')) {
  failures.push("dist/index.js no longer imports the board as an external module")
}

// The stylesheet has to travel inside the module. If a build ever emits it as a
// side-car .css again, the host app never loads it and the board renders as a
// column of unstyled text -- which nothing else here would catch.
if (!index.includes(".react-flow__renderer") || !index.includes(".redspec-root")) {
  failures.push("dist/index.js does not carry the stylesheet as text")
}

if (failures.length > 0) {
  console.error("client boundary broken:\n  " + failures.join("\n  "))
  process.exit(1)
}
