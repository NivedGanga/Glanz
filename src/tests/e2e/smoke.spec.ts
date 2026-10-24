import { test, expect } from "@playwright/test";
test("the two portals are reachable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/districts", route => route.fulfill({ json: { districts: [] } }));
  await page.route("**/api/categories", route => route.fulfill({ json: { categories: [] } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /costumes near you/i })).toBeVisible();
  await page.getByRole("link", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
});
