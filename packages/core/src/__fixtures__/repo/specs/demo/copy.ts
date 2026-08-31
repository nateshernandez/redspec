import { defineCopy } from "../../../../../types"

// The catalog is neither the default export nor named `copy`, and a sibling
// object sits beside it: finding it must not depend on either.
export const tone = { casual: true }

export const strings = defineCopy({
  "COPY-demo-roster-empty": "No one here but you",
  "COPY-demo-roster-invite": "Invite a teammate",
})
