// A flow compiled to a graph, so that reachability and path coverage are
// computed rather than eyeballed.
//
// The authored shape -- spine plus deviations -- is kept as the input because
// it privileges the happy path, which a raw statechart does not. It compiles
// to a plain directed graph: spine steps are edges labelled `on`, deviations
// are edges labelled `when`, a rejoin is an edge back to the spine, and an
// `end` is a terminal. Every simple path from the first step to a terminal is
// one Journey the feature admits, and coverage is walked-of-reachable.

import type { Flow, Spec } from "./types"

export type GraphEdge = {
  from: string
  to: string
  label: string
  kind: "spine" | "deviation" | "rejoin"
}

export type FlowGraph = {
  id: string
  /** Node id -> state id. A spine may revisit a state, so nodes are positional. */
  nodes: Map<string, string>
  edges: GraphEdge[]
  start: string | null
  /** Node id -> what the person is left with. */
  terminals: Map<string, string>
}

export function compileFlow(flow: Flow): FlowGraph {
  const nodes = new Map<string, string>()
  const edges: GraphEdge[] = []
  const terminals = new Map<string, string>()
  const stepNode = (i: number) => `${flow.id}:${i}`
  const firstStepFor = new Map<string, string>()

  flow.spine.forEach((step, i) => {
    nodes.set(stepNode(i), step.case)
    if (!firstStepFor.has(step.case)) firstStepFor.set(step.case, stepNode(i))
    if (step.end) terminals.set(stepNode(i), step.end)
    if (step.on && flow.spine[i + 1]) {
      edges.push({
        from: stepNode(i),
        to: stepNode(i + 1),
        label: step.on,
        kind: "spine",
      })
    }
  })

  flow.deviations.forEach((deviation, i) => {
    const node = `${flow.id}:dev:${i}`
    nodes.set(node, deviation.case)
    const from = firstStepFor.get(deviation.from)
    if (from) edges.push({ from, to: node, label: deviation.when, kind: "deviation" })
    if (deviation.end) terminals.set(node, deviation.end)
    const rejoins = deviation.rejoins ? firstStepFor.get(deviation.rejoins) : undefined
    if (rejoins) edges.push({ from: node, to: rejoins, label: "", kind: "rejoin" })
  })

  return {
    id: flow.id,
    nodes,
    edges,
    start: flow.spine.length > 0 ? stepNode(0) : null,
    terminals,
  }
}

/** Node ids reachable from the start. */
export function reachableNodes(graph: FlowGraph): Set<string> {
  const seen = new Set<string>()
  if (!graph.start) return seen
  const stack = [graph.start]
  while (stack.length) {
    const node = stack.pop()!
    if (seen.has(node)) continue
    seen.add(node)
    for (const edge of graph.edges) if (edge.from === node) stack.push(edge.to)
  }
  return seen
}

/** State IDs on this flow that no walk from its first step can reach. */
export function unreachableStates(graph: FlowGraph): string[] {
  const reachable = reachableNodes(graph)
  return [...graph.nodes]
    .filter(([node]) => !reachable.has(node))
    .map(([, state]) => state)
}

export type Path = { nodes: string[]; states: string[]; labels: string[]; end: string }

/**
 * Every simple path from the start to a terminal, up to `budget`. A rejoin
 * makes the graph cyclic, so "simple" -- no node twice -- is what keeps this
 * finite; a path that rejoins and then walks on to the end is still one path.
 */
export function simplePaths(
  graph: FlowGraph,
  budget = 200
): { paths: Path[]; truncated: boolean } {
  const paths: Path[] = []
  let truncated = false
  if (!graph.start) return { paths, truncated }

  const walk = (node: string, trail: string[], labels: string[]) => {
    if (paths.length >= budget) {
      truncated = true
      return
    }
    const here = [...trail, node]
    const end = graph.terminals.get(node)
    if (end !== undefined) {
      paths.push({
        nodes: here,
        states: here.map((n) => graph.nodes.get(n)!),
        labels,
        end,
      })
      // A terminal with outgoing edges is not a thing the types allow, so stop.
      return
    }
    for (const edge of graph.edges) {
      if (edge.from !== node || here.includes(edge.to)) continue
      walk(edge.to, here, [...labels, edge.label])
    }
  }

  walk(graph.start, [], [])
  return { paths, truncated }
}

export type FlowCoverage = {
  id: string
  reachablePaths: number
  truncated: boolean
  unreachable: string[]
}

export function flowCoverage(spec: Spec, budget = 200): FlowCoverage[] {
  return spec.flows.map((flow) => {
    const graph = compileFlow(flow)
    const { paths, truncated } = simplePaths(graph, budget)
    return {
      id: flow.id,
      reachablePaths: paths.length,
      truncated,
      unreachable: unreachableStates(graph),
    }
  })
}
