// The method as one source, rendered per harness.
//
// Everything that is genuinely conversational -- the interview, picking a
// rung, judging a waiver -- lives in the skills. Everything that is convention
// lives in the CLI, so the per-harness payload is small and generated, and it
// goes stale visibly rather than silently.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export type Harness = "claude" | "cursor" | "codex" | "copilot" | "gemini"

export const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "plugin")

export type Frontmatter = Record<string, string | boolean>
export type Doc = {
  name: string
  frontmatter: Frontmatter
  body: string
  extras: Record<string, string>
}

export function parseFrontmatter(text: string): {
  frontmatter: Frontmatter
  body: string
} {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { frontmatter: {}, body: text }
  const frontmatter: Frontmatter = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (!kv) continue
    let v: string | boolean = kv[2]!.trim()
    if (v === "true") v = true
    else if (v === "false") v = false
    else v = v.replace(/^"(.*)"$/, "$1")
    frontmatter[kv[1]!] = v
  }
  return { frontmatter, body: text.slice(m[0].length) }
}

export type Method = {
  steps: { skill: string; owner: string; hitl: boolean; produces: string }[]
  skills: Doc[]
  agents: Doc[]
  conventionsTemplate: string
  humansTemplate: string
}

export function readMethod(pluginDir = PLUGIN_DIR): Method {
  const manifest = JSON.parse(
    readFileSync(join(pluginDir, "method.json"), "utf8")
  ) as Method["steps"] extends infer S ? { steps: S } : never
  const skillsDir = join(pluginDir, "skills")
  const skills: Doc[] = readdirSync(skillsDir)
    .filter((d) => existsSync(join(skillsDir, d, "SKILL.md")))
    .sort()
    .map((name) => {
      const { frontmatter, body } = parseFrontmatter(
        readFileSync(join(skillsDir, name, "SKILL.md"), "utf8")
      )
      const extras: Record<string, string> = {}
      for (const f of readdirSync(join(skillsDir, name))) {
        if (f !== "SKILL.md" && f.endsWith(".md"))
          extras[f] = readFileSync(join(skillsDir, name, f), "utf8")
      }
      return { name, frontmatter, body, extras }
    })
  const agentsDir = join(pluginDir, "agents")
  const agents: Doc[] = readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const { frontmatter, body } = parseFrontmatter(
        readFileSync(join(agentsDir, f), "utf8")
      )
      return { name: f.replace(/\.md$/, ""), frontmatter, body, extras: {} }
    })
  return {
    steps: manifest.steps,
    skills,
    agents,
    conventionsTemplate: readFileSync(join(pluginDir, "docs", "conventions.md"), "utf8"),
    humansTemplate: readFileSync(join(pluginDir, "docs", "humans.md"), "utf8"),
  }
}

export type RenderContext = {
  specsDir: string
  route: string
  framework: "next" | "none"
  unitCommand: string
  stateCommand: string
  journeyCommand: string
  conventionsPath: string
}

export function fill(template: string, ctx: RenderContext): string {
  const gate =
    ctx.framework === "next"
      ? "Gated by `proxy.ts`, which answers 404 before anything renders whenever `NODE_ENV` is `production` — a layout-level `notFound()` still serializes the page into the response."
      : "Gate it before render in production: a response-level 404, not a layout-level one."
  return template
    .replaceAll("{{specsDir}}", ctx.specsDir)
    .replaceAll("{{route}}", ctx.route)
    .replaceAll("{{gate}}", gate)
    .replaceAll("{{unitCommand}}", ctx.unitCommand)
    .replaceAll("{{stateCommand}}", ctx.stateCommand)
    .replaceAll("{{journeyCommand}}", ctx.journeyCommand)
}

export type RenderedFile = { path: string; content: string; mode: "write" | "section" }

const START = "<!-- redspec:start -->"
const END = "<!-- redspec:end -->"

/** Replace the marked section of an existing file, or append one. Idempotent. */
export function mergeSection(existing: string | null, section: string): string {
  const block = `${START}\n${section.trim()}\n${END}\n`
  if (!existing) return block
  const s = existing.indexOf(START)
  const e = existing.indexOf(END)
  if (s !== -1 && e !== -1)
    return (
      existing.slice(0, s) + block + existing.slice(e + END.length).replace(/^\n/, "")
    )
  return existing.replace(/\s*$/, "\n\n") + block
}

function pointer(ctx: RenderContext): string {
  return [
    "# Spec flow (redspec)",
    "",
    "Specs here are **artifacts that can go red**, not documents.",
    "",
    `- \`redspec status\` is the work list; \`redspec check\` is the gate. Run \`check\` before saying you are done.`,
    `- Scaffold artifacts with \`redspec new\`; never hand-write into \`${ctx.specsDir}/\` and never edit \`.spec-lock.json\`.`,
    `- **\`${ctx.conventionsPath}\` carries the paths, the shapes, and every finding kind.** Read it before touching a spec.`,
    `- The spec route 404s in production, so both Playwright tiers run against the dev server.`,
  ].join("\n")
}

function stepsAsProse(method: Method): string {
  return method.skills
    .filter((s) => method.steps.some((st) => st.skill === s.name))
    .map((s) => `### /${s.name}\n\n${s.body.trim()}`)
    .join("\n\n")
}

/** Files to write for one harness, relative to the repo root. */
export function renderHarness(
  harness: Harness,
  method: Method,
  ctx: RenderContext
): RenderedFile[] {
  const files: RenderedFile[] = []
  const conventions = fill(method.conventionsTemplate, ctx)
  files.push({ path: ctx.conventionsPath, content: conventions, mode: "write" })
  files.push({
    path: "docs/humans/redspec.md",
    content: fill(method.humansTemplate, ctx),
    mode: "write",
  })

  switch (harness) {
    case "claude": {
      for (const s of method.skills) {
        files.push({
          path: `.claude/skills/${s.name}/SKILL.md`,
          content: serialize(s),
          mode: "write",
        })
        for (const [f, c] of Object.entries(s.extras))
          files.push({ path: `.claude/skills/${s.name}/${f}`, content: c, mode: "write" })
      }
      for (const a of method.agents)
        files.push({
          path: `.claude/agents/${a.name}.md`,
          content: serialize(a),
          mode: "write",
        })
      files.push({ path: "CLAUDE.md", content: pointer(ctx), mode: "section" })
      break
    }
    case "cursor": {
      // Steps are manual rules (@-mentioned): no description, no globs, alwaysApply false.
      for (const s of method.skills) {
        const manual = method.steps.some((st) => st.skill === s.name)
        const fm = manual
          ? `---\nalwaysApply: false\n---\n`
          : `---\ndescription: ${JSON.stringify(String(s.frontmatter.description ?? ""))}\nalwaysApply: false\n---\n`
        files.push({
          path: `.cursor/rules/redspec-${s.name}.mdc`,
          content: fm + s.body,
          mode: "write",
        })
      }
      for (const a of method.agents) {
        files.push({
          path: `.cursor/rules/redspec-agent-${a.name}.mdc`,
          content: `---\nalwaysApply: false\n---\n# ${a.name}\n\nRun this as a separate task with no memory of the conversation so far.\n\n${a.body}`,
          mode: "write",
        })
      }
      files.push({
        path: ".cursor/rules/redspec.mdc",
        content: `---\nalwaysApply: true\n---\n${pointer(ctx)}\n\nSteps are manual rules: @redspec-draft-skeleton, @redspec-render-states, @redspec-implement-rules, @redspec-cut-slices, @redspec-build-slice, @redspec-amend. Nothing stops an agent running one unprompted, so \`redspec check\` in CI is the guardrail.`,
        mode: "write",
      })
      files.push({ path: "AGENTS.md", content: pointer(ctx), mode: "section" })
      break
    }
    case "codex": {
      files.push({
        path: "AGENTS.md",
        content: `${pointer(ctx)}\n\n## The steps\n\nInvoke a step by name ("run /draft-skeleton"). Each stops for sign-off where it says HITL.\n\n${stepsAsProse(method)}\n\n## Agents\n\n${method.agents.map((a) => `### ${a.name}\n\nRun as a subtask with a fresh context.\n\n${a.body.trim()}`).join("\n\n")}`,
        mode: "section",
      })
      break
    }
    case "copilot": {
      files.push({
        path: ".github/copilot-instructions.md",
        content: pointer(ctx),
        mode: "section",
      })
      files.push({ path: "AGENTS.md", content: pointer(ctx), mode: "section" })
      for (const s of method.skills) {
        if (!method.steps.some((st) => st.skill === s.name)) continue
        files.push({
          path: `.github/prompts/redspec-${s.name}.prompt.md`,
          content: `---\nmode: agent\ndescription: ${JSON.stringify(String(s.frontmatter.description ?? ""))}\n---\n${s.body}`,
          mode: "write",
        })
      }
      break
    }
    case "gemini": {
      files.push({
        path: "GEMINI.md",
        content: `${pointer(ctx)}\n\n## The steps\n\n${stepsAsProse(method)}`,
        mode: "section",
      })
      break
    }
  }
  return files
}

function serialize(doc: Doc): string {
  const fm = Object.entries(doc.frontmatter)
    .map(
      ([k, v]) =>
        `${k}: ${typeof v === "boolean" ? v : /[:#]/.test(v) ? JSON.stringify(v) : v}`
    )
    .join("\n")
  return `---\n${fm}\n---\n${doc.body}`
}

/** What each harness can and cannot express, for `redspec doctor`. */
export const CAPABILITIES: Record<
  Harness,
  { hitlOnly: boolean; subagents: boolean; hooks: boolean; note: string }
> = {
  claude: {
    hitlOnly: true,
    subagents: true,
    hooks: true,
    note: "Steps are skills with disable-model-invocation; agents are subagents.",
  },
  cursor: {
    hitlOnly: false,
    subagents: false,
    hooks: false,
    note: "Steps are manual @rules. Nothing prevents an unprompted step; `redspec check` in CI is the guardrail.",
  },
  codex: {
    hitlOnly: false,
    subagents: false,
    hooks: false,
    note: "Steps are prose in AGENTS.md. Same caveat as Cursor.",
  },
  copilot: {
    hitlOnly: false,
    subagents: false,
    hooks: false,
    note: "Steps are prompt files; conventions via copilot-instructions.md and AGENTS.md.",
  },
  gemini: {
    hitlOnly: false,
    subagents: false,
    hooks: false,
    note: "Steps are prose in GEMINI.md.",
  },
}
