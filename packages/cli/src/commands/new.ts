import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pc from "picocolors"
import { compileFlow, ID_PATTERN, simplePaths } from "@redspec/core"
import { loadContext } from "../context"
import { Writer } from "../fs"
import * as t from "../templates"

const title = (slug: string) =>
  slug
    .split("-")
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(" ")

export async function newFeature(
  root: string,
  slug: string,
  quiet = false
): Promise<number> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error(pc.red(`"${slug}" is not a slug. Lowercase, hyphenated.`))
    return 1
  }
  const ctx = await loadContext(root)
  const dir = join(ctx.config.specsDir, slug)
  const w = new Writer(root)
  w.create(`${dir}/BRIEF.md`, t.brief(slug, title(slug)))
  w.create(`${dir}/${ctx.config.specFile}`, t.specTs(slug, title(slug)))
  w.create(`${dir}/copy.ts`, t.copyTs(slug))
  w.create(`${dir}/fixtures.ts`, t.fixturesTs())
  w.create(`${dir}/sketches.tsx`, t.sketchesTsx())
  w.create(`${dir}/rules/.gitkeep`, "")
  w.create(`${dir}/slices/.gitkeep`, "")
  w.create(`${ctx.config.stateTestsDir}/${slug}.spec.ts`, t.stateSpec(slug))
  w.create(`${ctx.config.journeyTestsDir}/${slug}.spec.ts`, t.journeySpecHeader(slug))

  // Register with the app: the index is the one place Next learns a feature exists.
  const indexPath = join(root, ctx.config.specsDir, "index.ts")
  if (existsSync(indexPath)) {
    const ident = slug.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) + "Spec"
    let src = readFileSync(indexPath, "utf8")
    if (!src.includes(`./${slug}/spec`)) {
      src = src.replace(
        "// redspec:imports",
        `import ${ident} from "./${slug}/spec"\n// redspec:imports`
      )
      src = src.replace("  // redspec:specs", `  ${ident},\n  // redspec:specs`)
      writeFileSync(indexPath, src)
      w.written.push({ path: `${ctx.config.specsDir}/index.ts`, action: "updated" })
    }
  }
  report(w, quiet)
  if (!quiet)
    console.log(
      pc.dim(
        `\nNow fill ${dir}/BRIEF.md and declare surfaces and flows in ${dir}/${ctx.config.specFile}. \`redspec status\` is the work list.`
      )
    )
  return 0
}

export async function newState(
  root: string,
  id: string,
  opts: { surface?: string; quiet?: boolean }
): Promise<number> {
  if (!ID_PATTERN.test(id) || !id.startsWith("STATE-")) {
    console.error(pc.red(`"${id}" is not a STATE- ID. Lowercase, hyphenated.`))
    return 1
  }
  const ctx = await loadContext(root)
  const owner = ctx.specs.find((s) => id.startsWith(`STATE-${s.spec.slug}-`))
  if (!owner) {
    console.error(
      pc.red(
        `No feature's slug prefixes "${id}". Features: ${ctx.specs.map((s) => s.spec.slug).join(", ") || "none"}.`
      )
    )
    return 1
  }
  const slug = owner.spec.slug
  const declared = ctx.reports
    .find((r) => r.slug === slug)!
    .artifacts.some((a) => a.id === id)
  if (!declared)
    console.log(
      pc.yellow(
        `  "${id}" is not declared by any checklist row or flow yet. Declare it in ${ctx.config.specFile} too, or the audit will call it unclaimed.`
      )
    )
  const rel = (f: string) => join(ctx.config.specsDir, slug, f)
  // Names drop the feature slug: STATE-roster-invites-roster-empty -> RosterEmpty.
  const local = id.slice(`STATE-${slug}-`.length)
  const component = t.pascal(local)
  const fixture = t.camel(local)
  const w = new Writer(root)
  if (!(w.read(rel("fixtures.ts")) ?? "").includes(`// ${id}`))
    w.append(rel("fixtures.ts"), t.stateFixture(id))
  if (!(w.read(rel("sketches.tsx")) ?? "").includes(`// ${id}`))
    w.append(rel("sketches.tsx"), t.stateSketch(id, component))
  const testPath = `${ctx.config.stateTestsDir}/${slug}.spec.ts`
  if (!(w.read(testPath) ?? "").includes(`"${id} `))
    w.append(testPath, t.stateAssertion(id).replace("<slug>", slug))
  report(w, opts.quiet)
  const surface = opts.surface ?? Object.keys(owner.spec.surfaces)[0] ?? "<surface>"
  if (!opts.quiet) {
    console.log(`\nAdd to \`cases\` in ${rel(ctx.config.specFile)}:\n`)
    console.log(t.caseSnippet(id, surface, component, fixture))
    console.log(
      pc.dim(
        "\nThen fill the fixture, the sketch (strings via copy.ts), and the assertion (user intent, no selectors)."
      )
    )
  }
  return 0
}

export async function newRule(
  root: string,
  id: string,
  opts: { feature?: string; form: string; quiet?: boolean }
): Promise<number> {
  if (!ID_PATTERN.test(id) || !/^(RULE|INV)-/.test(id)) {
    console.error(pc.red(`"${id}" is not a RULE- or INV- ID.`))
    return 1
  }
  const ctx = await loadContext(root)
  const slug =
    opts.feature ?? (ctx.specs.length === 1 ? ctx.specs[0]!.spec.slug : undefined)
  if (!slug) {
    console.error(pc.red("Pass --feature <slug>; more than one feature is declared."))
    return 1
  }
  const dir = join(ctx.config.specsDir, slug, "rules")
  const w = new Writer(root)
  switch (opts.form) {
    case "stub":
      w.create(`${dir}/${id}.md`, t.ruleStub(id))
      break
    case "table":
      w.create(`${dir}/${id}.md`, t.ruleTable(id))
      w.create(`${dir}/${id}.test.ts`, t.ruleTableTest(id))
      break
    case "machine":
      w.create(`${dir}/${id}.ts`, t.ruleMachine(id))
      w.create(`${dir}/${id}.test.ts`, t.ruleMachineTest(id))
      break
    case "invariant":
      w.create(`${dir}/${id}.test.ts`, t.ruleInvariant(id))
      w.create(`${dir}/${id}.ts`, `// ${id}: see ${id}.test.ts\nexport {}\n`)
      break
    case "type":
      w.create(`${dir}/${id}.ts`, t.ruleType(id))
      break
    default:
      console.error(pc.red(`--form must be stub, table, machine, invariant, or type.`))
      return 1
  }
  report(w, opts.quiet)
  return 0
}

export async function newSlice(
  root: string,
  slug: string,
  name: string,
  opts: { claims: string[]; amends: string[]; quiet?: boolean }
): Promise<number> {
  const ctx = await loadContext(root)
  if (!ctx.specs.some((s) => s.spec.slug === slug)) {
    console.error(pc.red(`No feature "${slug}".`))
    return 1
  }
  if (!/^A?\d{2}-[a-z0-9-]+$/.test(name)) {
    console.error(
      pc.red(
        `Slice files are <NN>-<name> (or A<NN>-<name> for an amendment): "${name}" is not.`
      )
    )
    return 1
  }
  const heading = `${name.split("-")[0]}: ${title(name.split("-").slice(1).join("-"))}`
  const w = new Writer(root)
  w.create(
    join(ctx.config.specsDir, slug, "slices", `${name}.md`),
    t.slice(heading, opts.claims, opts.amends)
  )
  report(w, opts.quiet)
  return 0
}

/** Regenerate the journey tier from the flows: one fixme per reachable path. */
export async function newJourneys(
  root: string,
  slug: string,
  quiet = false
): Promise<number> {
  const ctx = await loadContext(root)
  const owner = ctx.specs.find((s) => s.spec.slug === slug)
  if (!owner) {
    console.error(pc.red(`No feature "${slug}".`))
    return 1
  }
  let out = t.journeySpecHeader(slug)
  let n = 0
  for (const flow of owner.spec.flows) {
    const { paths, truncated } = simplePaths(compileFlow(flow), ctx.config.journeyBudget)
    paths.forEach((path, i) => {
      out += t.journeyTest(flow.id, i, path.states, path.labels, path.end)
      n++
    })
    if (truncated)
      out += `\n// ${flow.id}: path enumeration stopped at the budget (${ctx.config.journeyBudget}). Raise journeyBudget in spec.config.ts, or simplify the flow.\n`
  }
  const w = new Writer(root)
  w.write(`${ctx.config.journeyTestsDir}/${slug}.spec.ts`, out)
  report(w, quiet)
  if (!quiet)
    console.log(
      pc.dim(
        `${n} path${n === 1 ? "" : "s"} across ${owner.spec.flows.length} flow${owner.spec.flows.length === 1 ? "" : "s"}.`
      )
    )
  return 0
}

function report(w: Writer, quiet?: boolean) {
  if (quiet) return
  for (const f of w.written) {
    if (f.action === "kept") continue
    console.log(
      `  ${f.action === "created" ? pc.green("create") : pc.cyan("update")}  ${f.path}`
    )
  }
}
