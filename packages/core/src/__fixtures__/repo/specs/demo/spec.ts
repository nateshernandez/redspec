import { defineSpec } from "../../../../../types"
import { RosterEmpty, RosterPopulated } from "./sketches"

export default defineSpec({
  slug: "demo",
  title: "Demo",
  surfaces: {
    roster: {
      title: "Firm roster",
      checklist: {
        empty: { state: "STATE-demo-roster-empty" },
        loading: { state: "STATE-demo-roster-loading" },
        partial: { waived: "One query.", witness: "INV-demo-single-query" },
        populated: { state: "STATE-demo-roster-populated" },
        overflowing: { waived: "Demo only.", review: "2020-01-01" },
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
  cases: {
    "STATE-demo-roster-empty": {
      title: "Empty",
      surface: "roster",
      render: () => RosterEmpty(),
    },
    "STATE-demo-roster-populated": {
      title: "Three people",
      surface: "roster",
      render: () => RosterPopulated({ names: ["Dana"] }),
    },
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
})
