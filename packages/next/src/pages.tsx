import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  auditSpec,
  declaredStateIds,
  flowsBoard,
  readStateAssertions,
  readResolvedStates,
  surfacesBoard,
  type BoardContext,
  type Spec,
} from "@redspec/core"
import { SpecBoard } from "./board/board"

export type RouteOptions = {
  route?: string
  /**
   * Where the state-tier assertions live, so a node can show the intent its
   * assertion is named for. Read at request time: the board is a dev-only
   * route, and the assertion is already in the state's digest.
   */
  stateTestsDir?: string
  /** The bundle root, for the rules a resolution table lives in. */
  specsDir?: string
}

/**
 * The four route components a Next app re-exports from `app/spec/`. Each is a
 * one-line file in the app, so the machinery updates with the package rather
 * than living as a fork in every repo.
 */
export function createSpecRoutes(
  specs: Spec[],
  { route = "/spec", stateTestsDir = "e2e/state", specsDir = "specs" }: RouteOptions = {}
) {
  const bySlug = new Map(specs.map((s) => [s.slug, s]))

  /** Read fresh per request so an assertion edit shows up on the next reload. */
  function boardContext(spec: Spec): BoardContext {
    const root = process.cwd()
    return {
      assertions: readStateAssertions(root, stateTestsDir, spec),
      resolvedStates: readResolvedStates(root, specsDir, spec.slug),
    }
  }

  /** Defence in depth behind the proxy: the layout does the gate and nothing else. */
  function SpecLayout({ children }: { children: ReactNode }) {
    if (process.env.NODE_ENV === "production") notFound()
    return children
  }

  function SpecIndexPage() {
    return (
      <div className="redspec-root">
        <div className="redspec-index">
          <div className="redspec-index-inner">
            <h1>Specs</h1>
            <p className="redspec-index-lede">
              {specs.length === 0
                ? "Nothing declared yet."
                : `${specs.length} feature${specs.length === 1 ? "" : "s"} declared in this repo.`}
            </p>
            {specs.length === 0 ? (
              <p className="redspec-empty">
                No specs yet. Run <code>/draft-skeleton</code> to declare a feature&apos;s
                states, flows, and rules.
              </p>
            ) : (
              <table className="redspec-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>States</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {specs.map((spec) => {
                    // The same options the board audits with: a state a rule
                    // routes to is reached, and this page must not call a spec
                    // red while its own board, one click away, calls it clean.
                    const findings = auditSpec(spec, {
                      resolvedStates: boardContext(spec).resolvedStates,
                    })
                    return (
                      <tr key={spec.slug}>
                        <td>
                          <a href={`${route}/${spec.slug}`}>
                            <div className="redspec-name">{spec.title}</div>
                            <div className="redspec-muted">
                              {Object.keys(spec.surfaces).length} surfaces ·{" "}
                              {spec.flows.length} flows
                            </div>
                          </a>
                        </td>
                        <td>
                          <code>{spec.slug}</code>
                        </td>
                        <td className="redspec-muted">
                          {Object.keys(spec.cases).length} of{" "}
                          {declaredStateIds(spec).length} rendered
                        </td>
                        <td>
                          <span
                            className={
                              findings.length
                                ? "redspec-badge redspec-badge-alarm"
                                : "redspec-badge"
                            }
                          >
                            {findings.length === 0
                              ? "Clean"
                              : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  async function SpecBoardPage(props: { params: Promise<{ feature: string }> }) {
    const { feature } = await props.params
    const spec = bySlug.get(feature)
    if (!spec) notFound()
    const context = boardContext(spec)
    const findings = auditSpec(spec, { resolvedStates: context.resolvedStates })
    return (
      <div className="redspec-root">
        <div className="redspec-board-page">
          <header className="redspec-board-header">
            <nav>
              <a href={route}>Specs</a> <span className="redspec-muted">/</span>{" "}
              <strong>{spec.title}</strong>
            </nav>
            {findings.length === 0 ? (
              <span className="redspec-badge">Audit clean</span>
            ) : (
              <div className="redspec-findings">
                {findings.map((f) => (
                  <span
                    key={`${f.kind}:${f.id}`}
                    className="redspec-badge redspec-badge-alarm"
                    title={f.detail}
                  >
                    {f.kind}: {f.id}
                  </span>
                ))}
              </div>
            )}
          </header>
          <div className="redspec-board-canvas">
            <SpecBoard
              flows={flowsBoard(spec, context)}
              surfaces={surfacesBoard(spec, context)}
              route={route}
            />
          </div>
        </div>
      </div>
    )
  }

  /** One case, alone: no chrome, so an assertion and a screenshot have one state in frame. */
  async function SpecCasePage(props: {
    params: Promise<{ feature: string; case: string }>
  }) {
    const { feature, case: caseId } = await props.params
    const entry = bySlug.get(feature)?.cases[decodeURIComponent(caseId)]
    if (!entry) notFound()
    return entry.render()
  }

  function generateStaticParams() {
    return specs.map((s) => ({ feature: s.slug }))
  }

  return { SpecLayout, SpecIndexPage, SpecBoardPage, SpecCasePage, generateStaticParams }
}
