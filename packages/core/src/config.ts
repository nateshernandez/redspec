// `spec.config.ts`: the one file a repo owns.

export type Harness = "claude" | "cursor" | "codex" | "copilot" | "gemini"
export const HARNESSES: Harness[] = ["claude", "cursor", "codex", "copilot", "gemini"]

export type Framework = "next" | "none"

export type SpecConfig = {
  /** Where feature bundles live. Each holds BRIEF.md, spec.ts, rules/, slices/. */
  specsDir: string
  /** The file inside each bundle that exports the Spec. */
  specFile: string
  /** Where the state-tier assertions live, one file per feature. */
  stateTestsDir: string
  /** Where the journey-tier specs live. */
  journeyTestsDir: string
  /** The spec route's prefix in the app. */
  route: string
  framework: Framework
  caseViewport: { width: number; height: number }
  /** Require every waiver to name a witness rule. */
  waivers: "free" | "witnessed"
  /** How many simple paths per flow to enumerate before giving up. */
  journeyBudget: number
  accept: {
    /** Must exit 0 in the same invocation for `redspec accept` to stamp anything. */
    command: string
  }
  /** Which harnesses `redspec sync` writes agent context for. */
  harnesses: Harness[]
}

export const DEFAULT_CONFIG: SpecConfig = {
  specsDir: "specs",
  specFile: "spec.ts",
  stateTestsDir: "e2e/state",
  journeyTestsDir: "e2e/journey",
  route: "/spec",
  framework: "none",
  caseViewport: { width: 1280, height: 720 },
  waivers: "free",
  journeyBudget: 200,
  accept: { command: "pnpm test" },
  harnesses: [],
}

export type SpecConfigInput = {
  [K in keyof SpecConfig]?: K extends "accept" | "caseViewport"
    ? Partial<SpecConfig[K]>
    : SpecConfig[K]
}

export function defineSpecConfig(input: SpecConfigInput = {}): SpecConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    caseViewport: { ...DEFAULT_CONFIG.caseViewport, ...(input.caseViewport ?? {}) },
    accept: { ...DEFAULT_CONFIG.accept, ...(input.accept ?? {}) },
    harnesses: input.harnesses ?? DEFAULT_CONFIG.harnesses,
  }
}
