// Loading a repo's config and specs from disk. TypeScript, JSX and all, via
// jiti -- so the CLI reads the same `spec.ts` the app renders, and nothing has
// to be compiled first.

import { existsSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { createJiti } from "jiti"
import { defineSpecConfig } from "./config"
import type { SpecConfig } from "./config"
import type { Spec } from "./types"

const CONFIG_NAMES = [
  "spec.config.ts",
  "spec.config.mts",
  "spec.config.js",
  "spec.config.mjs",
]

export function findConfigFile(root: string): string | null {
  for (const name of CONFIG_NAMES) {
    const path = join(root, name)
    if (existsSync(path)) return path
  }
  return null
}

function loader(root: string) {
  return createJiti(join(root, "package.json"), {
    interopDefault: true,
    // Sketches are .tsx. jiti transforms JSX; the components never mount here.
    jsx: true,
    fsCache: false,
    moduleCache: false,
  })
}

export async function loadConfig(
  root: string
): Promise<{ config: SpecConfig; path: string | null }> {
  const path = findConfigFile(root)
  if (!path) return { config: defineSpecConfig(), path: null }
  const mod = (await loader(root).import(path)) as { default?: SpecConfig } | SpecConfig
  const config = ("default" in mod && mod.default ? mod.default : mod) as SpecConfig
  return { config: defineSpecConfig(config), path }
}

export type LoadedSpec = { spec: Spec; dir: string; file: string }

/** Every `specs/<slug>/` directory, whether or not it has a spec file yet. */
export function listBundles(root: string, config: SpecConfig): string[] {
  const dir = resolve(root, config.specsDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory())
    .sort()
}

export async function loadSpecs(root: string, config: SpecConfig): Promise<LoadedSpec[]> {
  const jiti = loader(root)
  const out: LoadedSpec[] = []
  for (const slug of listBundles(root, config)) {
    const dir = resolve(root, config.specsDir, slug)
    const file = join(dir, config.specFile)
    if (!existsSync(file)) continue
    const mod = (await jiti.import(file)) as Record<string, unknown>
    const spec = pickSpec(mod)
    if (!spec)
      throw new Error(
        `${file} exports nothing that looks like a Spec (needs slug, surfaces, cases, flows).`
      )
    if (spec.slug !== slug) {
      throw new Error(
        `${file} declares slug "${spec.slug}" but lives in specs/${slug}/. They must match.`
      )
    }
    out.push({ spec, dir, file })
  }
  return out
}

function pickSpec(mod: Record<string, unknown>): Spec | null {
  const candidates = [mod.default, mod.spec, ...Object.values(mod)]
  for (const c of candidates) {
    if (
      c &&
      typeof c === "object" &&
      "slug" in c &&
      "surfaces" in c &&
      "cases" in c &&
      "flows" in c
    ) {
      return c as Spec
    }
  }
  return null
}
