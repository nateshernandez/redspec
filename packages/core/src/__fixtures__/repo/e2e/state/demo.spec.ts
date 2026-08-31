import { expect, test } from "@playwright/test"
import { copy } from "../../specs/demo/copy"

test("STATE-demo-roster-empty offers the action that fills it", async ({ page }) => {
  await page.goto("/spec/demo/STATE-demo-roster-empty")
  await expect(page.getByText(copy["COPY-demo-roster-empty"])).toBeVisible()
  // Deliberately wrong: the catalog has no such entry, so `check` says so.
  await expect(page.getByText(copy["COPY-demo-roster-gone"])).toBeVisible()
})
