import { defineConfig } from "tsup"

const format = ["esm"] as const
const peers = ["react", "react-dom", "next"]

// The routes emit their own stylesheet, so a `.css` import has to hand back the
// source rather than becoming a side-effecting asset the host app never loads.
const loader = { ".css": "text" } as const
// A dependency is external by default, which would leave React Flow's
// stylesheet as a bare `import` the host app resolves as an asset -- and the
// text the module wanted would be `undefined`. Bundle every .css instead.
const noExternal = [/\.css$/]

// Two builds, because the board is a client boundary and esbuild strips a
// "use client" directive off any module it inlines into a bundle. Keeping the
// boundary in its own artifact is the only thing that survives bundling.
export default defineConfig([
  {
    // The server half: the routes, which read the filesystem at request time.
    entry: ["src/index.ts", "src/gate.ts"],
    format,
    dts: true,
    external: [...peers, "./board/board.js"],
    loader,
    noExternal,
  },
  {
    // The client half. Because index.ts and pages.tsx import it by the path
    // marked external above, esbuild never inlines it and its own "use client"
    // survives into dist -- which is what makes the `ssr: false` inside legal.
    // scripts/assert-client-boundary.mjs fails the build if that stops holding.
    entry: { "board/board": "src/board/board.tsx" },
    format,
    dts: true,
    external: peers,
    loader,
    noExternal,
  },
])
