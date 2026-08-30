import { describe, expect, it } from "vitest"
import {
  CAPABILITIES,
  mergeSection,
  parseFrontmatter,
  readMethod,
  renderHarness,
} from "./index"
import type { Harness, RenderContext } from "./index"

const ctx: RenderContext = {
  specsDir: "specs",
  route: "/spec",
  framework: "next",
  unitCommand: "pnpm test",
  stateCommand: "pnpm test:state",
  journeyCommand: "pnpm test:journey",
  conventionsPath: "docs/agents/redspec.md",
}

describe("the method source", () => {
  const method = readMethod()
  it("has a skill for every step and every reference", () => {
    const names = method.skills.map((s) => s.name)
    for (const step of method.steps) expect(names).toContain(step.skill)
    expect(names).toContain("spec-flow")
    expect(names).toContain("falsifiable-specs")
    expect(method.agents.map((a) => a.name)).toEqual(["slice-verifier", "spec-adversary"])
  })
  it("marks every step HITL-only for Claude", () => {
    for (const step of method.steps) {
      const skill = method.skills.find((s) => s.name === step.skill)!
      expect(skill.frontmatter["disable-model-invocation"]).toBe(true)
    }
  })
  it("parses frontmatter", () => {
    expect(
      parseFrontmatter('---\nname: x\ndescription: "a: b"\nflag: true\n---\nbody')
    ).toEqual({
      frontmatter: { name: "x", description: "a: b", flag: true },
      body: "body",
    })
  })
})

describe("rendering", () => {
  const method = readMethod()
  it("renders every harness with the conventions doc filled in", () => {
    for (const h of Object.keys(CAPABILITIES) as Harness[]) {
      const files = renderHarness(h, method, ctx)
      const conv = files.find((f) => f.path === ctx.conventionsPath)!
      expect(conv.content).not.toContain("{{")
      expect(conv.content).toContain("`/spec/<slug>`")
      expect(conv.content).toContain("proxy.ts")
    }
  })
  it("gives Claude skills and agents, Cursor manual rules, Codex a section", () => {
    const claude = renderHarness("claude", method, ctx).map((f) => f.path)
    expect(claude).toContain(".claude/skills/draft-skeleton/SKILL.md")
    expect(claude).toContain(".claude/skills/falsifiable-specs/RULES.md")
    expect(claude).toContain(".claude/agents/spec-adversary.md")
    const cursor = renderHarness("cursor", method, ctx)
    const step = cursor.find(
      (f) => f.path === ".cursor/rules/redspec-draft-skeleton.mdc"
    )!
    expect(step.content.startsWith("---\nalwaysApply: false\n---\n")).toBe(true)
    expect(step.content).not.toContain("description:")
    const always = cursor.find((f) => f.path === ".cursor/rules/redspec.mdc")!
    expect(always.content).toContain("alwaysApply: true")
    const codex = renderHarness("codex", method, ctx)
    expect(codex.find((f) => f.path === "AGENTS.md")!.mode).toBe("section")
    expect(codex.find((f) => f.path === "AGENTS.md")!.content).toContain("### /amend")
  })
  it("merges a section idempotently and leaves the rest of the file alone", () => {
    const once = mergeSection("# Mine\n\nkeep this\n", "hello")
    expect(once).toContain("keep this")
    expect(once).toContain("<!-- redspec:start -->\nhello\n<!-- redspec:end -->")
    const twice = mergeSection(once, "hello again")
    expect(twice).toContain("hello again")
    expect(twice).not.toContain("hello\n")
    expect(twice.match(/redspec:start/g)).toHaveLength(1)
  })
})
