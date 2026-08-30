import { describe, expect, it } from "vitest"
import { actorsInBrief, missingBriefSections } from "./brief"

describe("actorsInBrief", () => {
  it("reads actors when another section follows", () => {
    expect(
      actorsInBrief(
        "# F\n\n## Actors\n\n- **Firm owner**: x.\n- **Staffer**: y.\n\n## What changes\n\nz\n"
      )
    ).toEqual(["Firm owner", "Staffer"])
  })
  it("reads actors when Actors is the last section", () => {
    expect(
      actorsInBrief("# F\n\n## Actors\n\n- **Firm owner**: x.\n- **Staffer**: y.\n")
    ).toEqual(["Firm owner", "Staffer"])
  })
  it("is not thrown by a capital Z", () => {
    expect(
      actorsInBrief("## Actors\n\n- **Zoe the admin**: x.\n\n## What changes\n\nz")
    ).toEqual(["Zoe the admin"])
  })
  it("names the sections a Brief is missing", () => {
    expect(
      missingBriefSections("# F\n\n## Problem\n\nx\n\n## Actors\n\n- **A**: b")
    ).toEqual(["What changes", "Non-goals", "Deliberate unknowns"])
  })
})
