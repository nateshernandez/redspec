import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  auditSpec,
  declaredStateIds,
  flowsBoard,
  surfacesBoard,
  type Spec,
} from "@redspec/core"
import { SpecBoard } from "./board/board"

export type RouteOptions = { route?: string }

/**
 * The four route components a Next app re-exports from `app/spec/`. Each is a
 * one-line file in the app, so the machinery updates with the package rather
 * than living as a fork in every repo.
 */
export function createSpecRoutes(specs: Spec[], { route = "/spec" }: RouteOptions = {}) {
  const bySlug = new Map(specs.map((s) => [s.slug, s]))

  /** Defence in depth behind the proxy: the layout does the gate and nothing else. */
  function SpecLayout({ children }: { children: ReactNode }) {
    if (process.env.NODE_ENV === "production") notFound()
    return children
  }

  function SpecIndexPage() {
    return (
      <div className="redspec-index">
        <h1>Specs</h1>
        {specs.length === 0 ? (
          <p className="redspec-muted">
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
                const findings = auditSpec(spec)
                return (
                  <tr key={spec.slug}>
                    <td>
                      <a href={`${route}/${spec.slug}`}>{spec.title}</a>
                      <div className="redspec-muted">
                        {Object.keys(spec.surfaces).length} surfaces · {spec.flows.length}{" "}
                        flows
                      </div>
                    </td>
                    <td>
                      <code>{spec.slug}</code>
                    </td>
                    <td className="redspec-muted">
                      {Object.keys(spec.cases).length} of {declaredStateIds(spec).length}{" "}
                      rendered
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
    )
  }

  async function SpecBoardPage(props: { params: Promise<{ feature: string }> }) {
    const { feature } = await props.params
    const spec = bySlug.get(feature)
    if (!spec) notFound()
    const findings = auditSpec(spec)
    return (
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
            flows={flowsBoard(spec)}
            surfaces={surfacesBoard(spec)}
            route={route}
          />
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
