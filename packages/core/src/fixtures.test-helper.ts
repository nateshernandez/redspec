// A demo spec shared by the unit tests: one of everything, plus one state
// declared and deliberately left unrendered.
import type { Spec } from "./types"

export const demoSpec: Spec = {
  slug: "demo",
  title: "Demo",
  surfaces: {
    roster: {
      title: "Firm roster",
      checklist: {
        empty: { state: "STATE-demo-roster-empty" },
        loading: { state: "STATE-demo-roster-loading" },
        partial: { waived: "The roster is one query." },
        populated: { state: "STATE-demo-roster-populated" },
        overflowing: { waived: "Demo only." },
        recoverableError: { waived: "Demo only." },
        terminalError: { waived: "Demo only." },
        permissionDenied: { waived: "Demo only." },
        stale: { waived: "Demo only." },
        inFlight: { waived: "Demo only." },
        terminalSuccess: { waived: "A place, not a flow." },
        conflict: { waived: "Demo only." },
      },
    },
  },
  states: {
    "STATE-demo-roster-empty": "No teammates yet, and one Invite button",
    "STATE-demo-roster-loading": "Skeleton rows where the roster will be",
    "STATE-demo-roster-populated": "Three teammates, each with their access level",
  },
  cases: {
    "STATE-demo-roster-empty": { surface: "roster", render: () => null },
    "STATE-demo-roster-populated": { surface: "roster", render: () => null },
  },
  flows: [
    {
      id: "JOURNEY-demo-view-roster",
      title: "See who has access",
      actor: "Firm owner",
      spine: [
        { case: "STATE-demo-roster-empty", on: "Invites the first teammate" },
        { case: "STATE-demo-roster-populated", end: "The roster lists everyone." },
      ],
      deviations: [
        {
          from: "STATE-demo-roster-populated",
          when: "Cold cache",
          case: "STATE-demo-roster-loading",
          rejoins: "STATE-demo-roster-populated",
        },
      ],
    },
  ],
}

export const kinds = (findings: { kind: string }[]) => findings.map((f) => f.kind)
