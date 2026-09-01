<h1 align="center">redspec</h1>

<p align="center"><strong>Requirements that can fail.</strong><br/>Write a feature as artifacts a machine can find false — then find out the moment the code, <em>or the requirement</em>, moves.</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="status: in development" src="https://img.shields.io/badge/status-in%20development-orange.svg">
  <img alt="node &gt;=20" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg">
  <img alt="Claude Code · Cursor · Codex · Copilot · Gemini" src="https://img.shields.io/badge/agents-Claude%20Code%20%C2%B7%20Cursor%20%C2%B7%20Codex%20%C2%B7%20Copilot%20%C2%B7%20Gemini-8A2BE2.svg">
</p>

> **Status: in development.** The core, CLI, and method are tested and work end to end on a fresh Next.js app. Nothing is published to npm yet, the board has not been mounted in an example app from this repo, and names may still change. See [Status](#status) before depending on it.

---

- [Why](#why)
- [See it in action](#see-it-in-action)
- [Quick start](#quick-start)
- [What a feature looks like](#what-a-feature-looks-like)
- [The flow](#the-flow)
- [Commands](#commands)
- [The lock](#the-lock)
- [Agent harnesses](#agent-harnesses)
- [How it compares](#how-it-compares)
- [Packages](#packages)
- [Status](#status)
- [Contributing](#contributing)

## Why

Vibe coding put intent in a chat window, where nothing checked it. Spec-driven development moved intent into a document, where a human — or a model reading prose — checks it. Neither can tell you the one thing you need to know on a Tuesday six weeks later: **is what we built still what we meant?**

A document cannot go red. It stays wrong for weeks with nothing noticing, and when the requirement changes, nothing tells the code.

redspec replaces the document with **artifacts that fail**:

- a **state** fails when its assertion or screenshot does
- a **flow** fails when a state on it is unreachable
- a **rule** fails when the code disagrees — or when its decision table has a gap
- a **waiver** ("this screen cannot be half-loaded") fails when its witness rule does, when its review date passes, or when its reason is quietly softened after someone signed it
- and every one of them fails again when **its own content changes** after it was verified, until someone signs for the change

The Brief — one page of _why_, _who_, and _what's out_ — is the only prose left, and it is the only thing that cannot fail. That is why it is capped.

## See it in action

Every step of the method starts from the work list, not from a conversation:

```
$ redspec status

roster-invites                                    7 of 11 states rendered

  DECLARED — not yet rendered                     → /render-states
    STATE-roster-invites-list-loading             Roster · Loading
    STATE-roster-invites-invite-conflict          Invite · Conflict

  AMENDED — changed since it was verified         → /amend, or redspec accept
    RULE-roster-invites-cooldown                  (specs/roster-invites/slices/02-invite.md)
      amended: Verified 2026-08-14 by 02-invite.md against sha256:9f2c…; content is now sha256:41ab…

  DECISION TABLES                                 → make the table total
    RULE-roster-invites-cooldown
      table-gap: daysSinceInvite ∈ (7..∞), plan = pro is matched by no row.

  4 findings · 2 flows · 5 reachable paths · 9 of 11 artifacts stamped
```

The gate is one command, and it is what CI runs:

```
$ redspec check
amended                  RULE-roster-invites-cooldown  specs/roster-invites/slices/02-invite.md
table-gap                RULE-roster-invites-cooldown
…
4 findings. Exit 1.
```

And re-signing a requirement that moved is impossible without a passing run:

```
$ redspec accept RULE-roster-invites-cooldown --clarification "reworded the note column"
$ pnpm test && pnpm test:state
  …
  stamped  RULE-roster-invites-cooldown  ← specs/roster-invites/slices/A03-cooldown.md
```

Product signs off in a browser, not in a document. The board at `/spec/<feature>` lays every state along the path that reaches it, frames the live case in each node, draws a dashed stub for every state that is declared but not yet built, and puts anything nothing reaches in a red lane. Waivers are struck through with the reason — and the rule that would falsify them.

Under each state the board writes three lines, and **authors none of them**:

```
Given  some data present, some still arriving or failed
When   Invites the first teammate
Then   lists everyone who has accepted, and no one who has not
```

The _Given_ is the checklist row's own situation, the _When_ is the flow's edge label, the _Then_ is the title of the state's assertion. All three are already inside a digest, so the board reads what `check` verifies rather than a caption someone can edit out from under it. That is the bar for anything shown to a reviewer here: if signing off on it is the point, it has to be able to go red.

## Quick start

Requires Node 20+ and, for the spec route and board, Next.js 16. Without Next you get everything except the route and the board.

```bash
npx @redspec/cli init
```

`init` detects your framework and every agent harness already in the repo, asks which to write context for, and then runs its own doctor. It leaves almost nothing behind:

```
spec.config.ts               the one file you own
proxy.ts                     404s the spec route in production — before render
app/spec/…                   four one-line re-exports from @redspec/next
specs/index.ts               which features the app knows about
docs/agents/redspec.md       conventions, generated for this repo's paths and commands
.claude/ .cursor/ AGENTS.md  the method, rendered for the harnesses you picked
```

Then, in your agent:

```
/draft-skeleton   invite teammates into a firm and manage who has access
```

The machinery lives in `node_modules`, not in your repo. When redspec upgrades, `redspec doctor` tells you which generated files are stale and `redspec sync` re-renders them.

### Publishing the board

The board is a development surface. It shows unshipped screens, every waiver with its reasoning, and the fixtures behind each case — so `proxy.ts` answers 404 for the whole route in production, and `SpecLayout` calls `notFound()` behind it in case the proxy is ever bypassed.

A few repos want the opposite: the spec **is** the product, as in a demo, a showcase, or a teaching repo. Opening the route takes three things that agree, each visible somewhere different:

```ts
// spec.config.ts — the intent, in a file that shows up in a diff
export default defineSpecConfig({ publicBoard: true })

// proxy.ts — the wiring, explicit at the call site
export const proxy = createSpecProxy({
  route: "/spec",
  publish: process.env.REDSPEC_PUBLISH_BOARD === "1",
})
```

```bash
# the switch, in the one environment that should serve it
REDSPEC_PUBLISH_BOARD=1
```

`createSpecRoutes` takes the same `publish` value, and it has to match — the proxy letting a request through while the layout still 404s is a blank page with no explanation. Any one of the three missing and the gate holds shut.

`redspec check` reports `board-published` when the environment variable is set in a repo whose `spec.config.ts` does not declare `publicBoard`, which is what a repo copied from someone else's looks like. A repo that declares it stays clean, and its generated agent context says so in place of the usual 404 note.

## What a feature looks like

One directory. The slug is the URL, the test name, and the claim.

```
specs/roster-invites/
  BRIEF.md              why, actors, what changes, non-goals, unknowns — one page, finished first
  spec.ts               surfaces, cases, flows
  copy.ts               every user-facing string, once
  fixtures.ts           plain data; a case that reaches for the network is a Journey in disguise
  sketches.tsx          draft markup a slice later promotes into components/
  rules/
    RULE-cooldown.md    a total decision table
    RULE-lifecycle.ts   a machine table + model-based test
    INV-owner-never-zero.ts
  slices/
    01-roster.md        claims the artifacts it makes green
    A03-cooldown.md     an amendment: what moved, and why
  .spec-lock.json       what was verified, against what content, by which slice
```

The declaration is typed so the sign-off is enforced by the compiler where it can be:

```ts
import { defineSpec } from "@redspec/core"

export default defineSpec({
  slug: "roster-invites",
  title: "Roster and invitations",

  surfaces: {
    roster: {
      title: "Firm roster",
      // All twelve rows are required. A row cannot be dropped — only waived, out loud.
      checklist: {
        empty: { state: "STATE-roster-invites-roster-empty" },
        loading: { state: "STATE-roster-invites-roster-loading" },
        partial: {
          waived: "The roster is one query.",
          witness: "INV-roster-invites-single-query",
        },
        stale: { waived: "Reads are live.", review: "2027-01-01" },
        // …
      },
    },
  },

  cases: {}, // empty after /draft-skeleton — every state above is a stub on the board, and red

  flows: [
    {
      id: "JOURNEY-roster-invites-accept",
      actor: "Invited teammate", // must match a bolded actor in BRIEF.md
      spine: [
        { case: "STATE-roster-invites-invite-open", on: "Accepts" },
        { case: "STATE-roster-invites-roster-populated", end: "They're on the roster." },
      ],
      deviations: [
        {
          from: "STATE-roster-invites-invite-open",
          when: "Past its cooldown",
          case: "STATE-roster-invites-invite-expired",
          rejoins: "STATE-roster-invites-invite-open",
        },
      ],
    },
  ],
})
```

A step either leads on (`on`) or ends (`end`, saying what the person is left with) — never both, never neither, or it does not compile. Every case reference is a plain string, so a skeleton with nothing rendered is legal, expected, and red.

A rule the business owns is a table the business can read — and one the machine can prove total:

```md
## RULE-roster-invites-cooldown

**Inputs:** daysSinceInvite: number(0..), plan: {free, pro}
**Hit policy:** UNIQUE

| daysSinceInvite | plan | outcome |
| --------------- | ---- | ------- |
| [0..7)          | -    | blocked |
| [7..]           | free | allowed |
| [7..]           | pro  | allowed |
```

`redspec check` walks every elementary region of the input space and reports any combination no row covers, and any two rows that both match under `UNIQUE`. The test then drives the implementation across _every_ region the table distinguishes, not only the listed points.

Name the outcome column `state` and the same machinery routes to **screens** rather than to values — a **resolution table**, and the one place a feature declares dimensions of its own:

```md
**Inputs:** linkAge: {fresh, expired}, account: {none, locked}

| linkAge | account | state                                |
| ------- | ------- | ------------------------------------ |
| fresh   | -       | STATE-roster-invites-invite-open     |
| expired | none    | STATE-roster-invites-invite-expired  |
| expired | locked  | STATE-roster-invites-invite-blocked  |
```

The cross product is proved total, every outcome is a state with a face on the board, and a state a table routes to is _reached_ — it appears in its own lane rather than the red one, and still owes the checklist a row. The twelve rows stay fixed on purpose: they are a taxonomy that transfers between features, and a repo that can delete rows deletes the four it most needed.

## The flow

Six steps, each **HITL** — it stops and waits for the person who owns it — and each starting from `redspec status` rather than from the previous conversation. Product signs the Brief and the board. Engineering signs the rungs and the slicing. Neither reviews a document on the other's behalf.

|     | Skill              | Owner           | Ends with                                                           |
| --- | ------------------ | --------------- | ------------------------------------------------------------------- |
| 1   | `/draft-skeleton`  | product         | the Brief, and every state, flow, and rule **declared and red**     |
| 2   | `/render-states`   | product         | each state rendered and asserted; the board signed off in a browser |
| 3   | `/implement-rules` | engineering     | each rule on the cheapest rung that can fail — and proven red once  |
| 4   | `/cut-slices`      | engineering     | vertical slices; every artifact claimed exactly once                |
| 5   | `/build-slice`     | engineering     | one slice green, its claims **stamped**, PR open. Repeat            |
| ∞   | `/amend`           | whoever owns it | a changed artifact re-signed and re-stamped                         |

Two adversarial agents do the work nobody can do on their own writing: **spec-adversary** reads a bundle cold and reports what it failed to say; **slice-verifier** checks a diff against its claims with no memory of having written it.

The method is in [`packages/method/plugin`](packages/method/plugin) — one source, rendered per harness. The guide for the person signing off is generated into your repo as `docs/humans/redspec.md`.

## Commands

| Command                                   | What it does                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `redspec init`                            | detect framework and harnesses; write config, gate, routes, and agent context |
| `redspec status`                          | the work list, grouped and in English                                         |
| `redspec check`                           | the gate: audit, coverage, decision tables, lock. Exit 1 on any finding       |
| `redspec new feature <slug>`              | a bundle, both test files, and a registry entry                               |
| `redspec new state <ID>`                  | fixture, sketch, and assertion scaffolds; prints the `cases` entry            |
| `redspec new rule <ID> --form <f>`        | `stub` \| `table` \| `machine` \| `invariant` \| `type`                       |
| `redspec new slice <slug> <NN-name>`      | `--claims …` and, for an amendment, `--amends …`                              |
| `redspec new journeys <slug>`             | regenerate the journey tier: one test per reachable path                      |
| `redspec accept <ID…>` / `--slice <path>` | run the verification command; stamp **only** if it passes                     |
| `redspec sync`                            | re-render agent context after an upgrade or a config change                   |
| `redspec doctor`                          | verify the install; say what each harness can and cannot enforce              |
| `redspec board [feature]`                 | dev server plus the board URL                                                 |

Every finding kind, what it means, and what clears it is in the generated `docs/agents/redspec.md`.

## The lock

`specs/<feature>/.spec-lock.json` records, for every claimed artifact, a digest of its content at the moment the slice that claimed it was verified:

```json
"RULE-roster-invites-cooldown": {"digest":"sha256:9f2c…","slice":"specs/roster-invites/slices/02-invite.md","at":"2026-08-14T11:02:00Z","commit":"c69a35c"}
```

What is digested is the _meaning_, per kind — a flow is its ordered steps and edge labels, not its title; a surface is its name and its twelve answers _including the waiver reasons_; a rule is its normalized markdown and code; a state is its title, its assertion, its screenshot baseline, its surface and row, and the `COPY-` entries its assertion asserts against. The test for what belongs in a digest is whether a reviewer signs off on it: anything the board shows them and the digest omits can be changed afterwards with `check` still green. One entry per line, keys sorted, so two slices landing the same week merge cleanly.

A surface is an artifact like any other: `SURFACE-<slug>-<key>` is claimed by the slice that builds the screen and stamped by the same passing run. That is what makes a waiver falsifiable rather than decorative — weaken "the roster is one query" to "the roster is usually one query" and `check` reports it `amended` until someone signs for it.

Change any of it and `check` reports **`amended`** until an amendment slice re-verifies it or `accept` re-stamps it after a passing run. There is no flag that skips the run. That closes the gap every other approach leaves open: a requirement that moves without anyone signing for it.

## Agent harnesses

The method is one source; `init` and `sync` render it for whichever harnesses the repo uses.

| Harness         | Rendered as                                                                                         | Steps are…                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Claude Code** | `.claude/skills/`, `.claude/agents/`, a section in `CLAUDE.md` — or [install the plugin](#packages) | skills with `disable-model-invocation`: **HITL-only**, agents as subagents |
| **Cursor**      | manual `.cursor/rules/*.mdc` plus one always-on rule; `AGENTS.md`                                   | conventions                                                                |
| **Codex**       | a section in `AGENTS.md`                                                                            | conventions                                                                |
| **Copilot**     | `.github/copilot-instructions.md`, `.github/prompts/*.prompt.md`, `AGENTS.md`                       | conventions                                                                |
| **Gemini**      | a section in `GEMINI.md`                                                                            | conventions                                                                |

Only Claude Code can make a step impossible for the agent to run unprompted; `redspec doctor` says so. Everywhere else, `redspec check` in CI and a pre-commit hook is the guardrail: the _outcome_ is enforced even where the _process_ is only suggested. Sections are merged between markers, so your own `CLAUDE.md` or `AGENTS.md` text is never touched.

## How it compares

|                                                                          | Where intent lives                                | What checks it                                                  | Notices when the requirement changes?                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Vibe coding                                                              | the chat                                          | nobody                                                          | no                                                                                                                    |
| [Spec Kit](https://github.com/github/spec-kit), [Kiro](https://kiro.dev) | prose `spec.md` / `plan.md` / `tasks.md`          | a model reading prose; `/analyze` on request                    | no — [by design](https://github.com/github/spec-kit/blob/main/docs/guides/evolving-specs.md), it relies on discipline |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec)                       | prose proposals with delta markers                | a model; human review                                           | no                                                                                                                    |
| [drift](https://github.com/fiberplane/drift), SpecLoom                   | docs bound to code by AST hash                    | a CLI                                                           | the _other_ direction: code changed, so the doc is stale                                                              |
| **redspec**                                                              | typed declarations, tables, tests, a copy catalog | the compiler, Vitest, Playwright, and the lock, on every commit | **yes** — `amended`, until someone signs                                                                              |

redspec is not a replacement for a good conversation with your agent, and it is heavier than a prose spec. It earns that on work that touches several layers and more than one session; a one-file fix needs none of it.

## Packages

| Package                              | What it is                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`@redspec/core`](packages/core)     | `defineSpec`, the audit, flow graph and path enumeration, digest + lock, coverage, total decision tables, board layout. Framework-free. |
| [`@redspec/cli`](packages/cli)       | `redspec`                                                                                                                               |
| [`@redspec/method`](packages/method) | the skills and agents as one source, rendered per harness. `plugin/` is a complete Claude Code plugin.                                  |
| [`@redspec/next`](packages/next)     | the spec route, the board, and the `proxy.ts` production gate for Next.js 16                                                            |

This repo is also a Claude Code marketplace:

```
/plugin marketplace add natehernandez/redspec
/plugin install redspec@redspec
```

## Status

**In development.** What that means concretely:

|     |                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | `@redspec/core`, `@redspec/cli`, `@redspec/method`: built, typechecked, 64 tests, and the CLI smoke-tested end to end (`init` → `new feature` → `status` → `check` → `accept` → `doctor`) on a fresh Next app |
| ✅  | the lock and the `amended` finding; total decision tables with gap/overlap analysis; harness detection and generated, staleness-checked context                                                               |
| ⚠️  | `@redspec/next` typechecks and builds, and is a port of a board that works — but has not yet been mounted in an example app from this repo                                                                    |
| ⚠️  | `publicBoard` opens the production route for demo repos; the default stays closed and the three-key wiring is covered by tests, but it has not yet run on a real deploy                                       |
| ⚠️  | journeys are enumerated from the flow graph and scaffolded as `test.fixme`, not yet executed against a machine                                                                                                |
| ⚠️  | state digests do not yet include the `COPY-` entries a case renders                                                                                                                                           |
| ❌  | not published to npm; the `npx` command above will work once it is                                                                                                                                            |
| ❌  | only one framework adapter (Next.js 16); the hosted board with per-PR previews and recorded sign-offs does not exist                                                                                          |

Ordered plans are in [ROADMAP.md](ROADMAP.md). The name may still change.

## Contributing

Small fixes: open a PR. Anything larger: open an issue first and say which artifact would go red if the change were wrong — that is the bar the repo holds itself to. See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm install
pnpm check      # build → typecheck → test
```

## License

[MIT](LICENSE)
