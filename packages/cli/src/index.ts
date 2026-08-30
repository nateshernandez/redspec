import { Command } from "commander"
import type { Framework } from "@redspec/core"
import { accept } from "./commands/accept"
import { board } from "./commands/board"
import { check } from "./commands/check"
import { doctor } from "./commands/doctor"
import { init } from "./commands/init"
import { newFeature, newJourneys, newRule, newSlice, newState } from "./commands/new"
import { status } from "./commands/status"
import { sync } from "./commands/sync"
import { loadContext } from "./context"

export {
  init,
  check,
  status,
  accept,
  doctor,
  sync,
  newFeature,
  newState,
  newRule,
  newSlice,
  newJourneys,
}
export { loadContext } from "./context"
export { detectHarnesses, detectFramework } from "./harness"

export function program(): Command {
  const cli = new Command("redspec")
    .description("Specs made of artifacts that can go red.")
    .option("-C, --cwd <dir>", "repo root", process.cwd())
    .exitOverride()
  const root = () => cli.opts<{ cwd: string }>().cwd

  cli
    .command("init")
    .description(
      "Set this repo up: config, spec route, test tiers, and agent context for the harnesses you use."
    )
    .option("-y, --yes", "accept detected defaults, no prompts")
    .option("--harness <list>", "comma-separated: claude,cursor,codex,copilot,gemini")
    .option("--framework <name>", "next | none")
    .action(async (o: { yes?: boolean; harness?: string; framework?: Framework }) => {
      await init({ root: root(), ...o })
    })

  cli
    .command("check")
    .description(
      "The gate: audit, coverage, decision tables, lock. Exit 1 on any finding."
    )
    .option("--json", "machine-readable")
    .option("-q, --quiet", "only the summary line")
    .action(async (o: { json?: boolean; quiet?: boolean }) =>
      process.exit(await check(root(), o))
    )

  cli
    .command("status")
    .description("The work list, in English.")
    .option("--ids [slug]", "list artifact IDs (optionally for one feature) and exit")
    .action(async (o: { ids?: string | boolean }) =>
      process.exit(
        await status(root(), {
          ids: o.ids === true ? "" : o.ids === false ? undefined : o.ids,
        })
      )
    )

  const n = cli
    .command("new")
    .description("Scaffold an artifact. Never hand-write what this writes.")
  n.command("feature <slug>")
    .description(
      "a bundle: BRIEF, spec.ts, copy, fixtures, sketches, rules/, slices/, both test files"
    )
    .action(async (slug: string) => process.exit(await newFeature(root(), slug)))
  n.command("state <id>")
    .description("fixture, sketch, and assertion scaffolds for a declared STATE-")
    .option("--surface <key>")
    .action(async (id: string, o: { surface?: string }) =>
      process.exit(await newState(root(), id, o))
    )
  n.command("rule <id>")
    .description("a rule on a rung")
    .requiredOption("--form <form>", "stub | table | machine | invariant | type")
    .option("--feature <slug>")
    .action(async (id: string, o: { form: string; feature?: string }) =>
      process.exit(await newRule(root(), id, o))
    )
  n.command("slice <slug> <name>")
    .description("a slice file: <NN>-<name>, or A<NN>-<name> for an amendment")
    .option("--claims <ids...>", "artifact IDs", [])
    .option("--amends <ids...>", "artifact IDs this amends", [])
    .action(
      async (slug: string, name: string, o: { claims: string[]; amends: string[] }) =>
        process.exit(await newSlice(root(), slug, name, o))
    )
  n.command("journeys <slug>")
    .description(
      "regenerate the journey tier from the flows, one fixme per reachable path"
    )
    .action(async (slug: string) => process.exit(await newJourneys(root(), slug)))

  cli
    .command("accept [ids...]")
    .description(
      "Re-stamp artifacts after the verification command passes in this same run."
    )
    .option("--slice <path>", "stamp every claim of one slice")
    .option("--clarification <note>", "record that the change was wording, not behaviour")
    .option("--command <cmd>", "override the configured verification command")
    .action(
      async (
        ids: string[],
        o: { slice?: string; clarification?: string; command?: string }
      ) => process.exit(await accept(root(), { ids, ...o }))
    )

  cli
    .command("sync")
    .description("Re-render agent context for the configured harnesses.")
    .action(async () => {
      const ctx = await loadContext(root())
      const w = sync(root(), ctx.config)
      for (const f of w.written)
        if (f.action !== "kept") console.log(`  ${f.action.padEnd(8)}${f.path}`)
    })

  cli
    .command("doctor")
    .description("Verify the install and say what each harness can and cannot enforce.")
    .action(async () => process.exit(await doctor(root())))
  cli
    .command("board [feature]")
    .description("Start the dev server and print the board URL.")
    .action(async (feature?: string) => process.exit(await board(root(), feature)))

  return cli
}

export async function run(argv: string[]): Promise<void> {
  try {
    await program().parseAsync(argv)
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (
      err.code === "commander.helpDisplayed" ||
      err.code === "commander.version" ||
      err.code === "commander.help"
    )
      return
    console.error(err.message ?? String(e))
    process.exit(1)
  }
}
