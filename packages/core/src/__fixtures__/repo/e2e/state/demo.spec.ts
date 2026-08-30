import { expect, test } from "@playwright/test"

test("STATE-demo-roster-empty offers the action that fills it", async ({ page }) => {
  await page.goto("/spec/demo/STATE-demo-roster-empty")
  await expect(page.getByText(/no one here but you/i)).toBeVisible()
})
