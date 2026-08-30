import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Framework, Harness } from "@redspec/core"

export type Detection = { harness: Harness; evidence: string }

/** Which agent harnesses this repo already shows signs of. */
export function detectHarnesses(
  root: string,
  env: NodeJS.ProcessEnv = process.env
): Detection[] {
  const found: Detection[] = []
  const has = (p: string) => existsSync(join(root, p))
  if (has(".claude") || has("CLAUDE.md") || env.CLAUDECODE)
    found.push({
      harness: "claude",
      evidence: has(".claude")
        ? ".claude/"
        : has("CLAUDE.md")
          ? "CLAUDE.md"
          : "$CLAUDECODE",
    })
  if (has(".cursor") || has(".cursorrules") || env.CURSOR_TRACE_ID)
    found.push({
      harness: "cursor",
      evidence: has(".cursor") ? ".cursor/" : ".cursorrules",
    })
  // AGENTS.md is read by Cursor and Copilot too, and redspec writes one for
  // them -- so it only counts as Codex when it says more than our own section.
  const agentsMd = has("AGENTS.md") ? readFileSync(join(root, "AGENTS.md"), "utf8") : null
  const foreignAgentsMd =
    agentsMd !== null &&
    agentsMd.replace(/<!-- redspec:start -->[\s\S]*?<!-- redspec:end -->/g, "").trim()
      .length > 0
  if (has(".codex") || foreignAgentsMd)
    found.push({ harness: "codex", evidence: has(".codex") ? ".codex/" : "AGENTS.md" })
  if (has(".github/copilot-instructions.md") || has(".github/prompts"))
    found.push({ harness: "copilot", evidence: ".github/copilot-instructions.md" })
  if (has(".gemini") || has("GEMINI.md"))
    found.push({ harness: "gemini", evidence: has(".gemini") ? ".gemini/" : "GEMINI.md" })
  return found
}

export function detectFramework(pkg: Record<string, unknown> | null): Framework {
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) ?? {}),
    ...((pkg?.devDependencies as Record<string, string>) ?? {}),
  }
  if (deps.next) return "next"
  return "none"
}

export function hasTestRunner(pkg: Record<string, unknown> | null): {
  unit: string | null
  browser: string | null
} {
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) ?? {}),
    ...((pkg?.devDependencies as Record<string, string>) ?? {}),
  }
  return {
    unit: deps.vitest ? "vitest" : deps.jest ? "jest" : null,
    browser: deps["@playwright/test"] ? "playwright" : null,
  }
}
