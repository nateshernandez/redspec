import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  readMethod,
  renderHarness,
  type Harness,
  type RenderContext,
  type RenderedFile,
} from "@redspec/method"
import type { SpecConfig } from "@redspec/core"
import { Writer } from "../fs"
import { packageManager, runScript } from "../context"

export const CONTEXT_LOCK = ".redspec/contexts.json"

export type ContextLock = { version: number; files: Record<string, string> }

const digest = (s: string) =>
  "sha256:" + createHash("sha256").update(s).digest("hex").slice(0, 16)

export function renderContext(root: string, config: SpecConfig): RenderContext {
  const pm = packageManager(root)
  return {
    specsDir: config.specsDir,
    route: config.route,
    framework: config.framework,
    unitCommand: runScript(pm, "test"),
    stateCommand: runScript(pm, "test:state"),
    journeyCommand: runScript(pm, "test:journey"),
    conventionsPath: "docs/agents/redspec.md",
  }
}

/** Render every configured harness's context and record what was written. */
export function sync(
  root: string,
  config: SpecConfig,
  harnesses: Harness[] = config.harnesses as Harness[]
): Writer {
  const method = readMethod()
  const ctx = renderContext(root, config)
  const w = new Writer(root)
  const lock: ContextLock = { version: 1, files: {} }
  // Two harnesses can target the same file (Cursor and Codex both use
  // AGENTS.md). One section per file: keep the fullest rendering.
  const files = new Map<string, RenderedFile>()
  for (const h of harnesses) {
    for (const f of renderHarness(h, method, ctx)) {
      const prev = files.get(f.path)
      if (!prev || f.content.length > prev.content.length) files.set(f.path, f)
    }
  }
  for (const f of files.values()) {
    if (f.mode === "section") w.section(f.path, f.content)
    else w.write(f.path, f.content)
    lock.files[f.path] = digest(f.content)
  }
  w.write(CONTEXT_LOCK, JSON.stringify(lock, null, 2) + "\n")
  return w
}

/** Contexts whose rendering has moved since they were written -- an upgrade, or a config change. */
export function staleContexts(root: string, config: SpecConfig): string[] {
  const lockPath = join(root, CONTEXT_LOCK)
  if (!existsSync(lockPath)) return []
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as ContextLock
  const method = readMethod()
  const ctx = renderContext(root, config)
  const files = new Map<string, RenderedFile>()
  for (const h of config.harnesses as Harness[]) {
    for (const f of renderHarness(h, method, ctx)) {
      const prev = files.get(f.path)
      if (!prev || f.content.length > prev.content.length) files.set(f.path, f)
    }
  }
  return [...files.values()]
    .filter((f) => lock.files[f.path] !== digest(f.content))
    .map((f) => f.path)
}
