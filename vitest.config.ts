import { defineConfig } from "vitest/config"

export default defineConfig({
  // Workspace packages resolve to src via tsconfig paths, so tests need no build.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
