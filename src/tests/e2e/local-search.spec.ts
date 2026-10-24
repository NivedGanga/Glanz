import { test, expect } from "@playwright/test";

test("local demo finds a published dress from a misspelled keyword", async ({ page, request }) => {
  test.skip(process.env.RUN_DEMO_E2E !== "1", "Requires npm run demo:local and the local database");
  const response = await request.get("/api/districts");
  expect(response.ok()).toBe(true);
  const { districts } = await response.json() as { districts: { id: string; timezone: string }[] };
  const district = districts[0];
  const date = (days: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: district.timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(Date.now() + days * 86_400_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByLabel("District").selectOption(district.id);
  await page.getByLabel("Event date").fill(date(15));
  await page.getByLabel("Return date").fill(date(16));
  await page.getByLabel("Keyword").fill("dresss");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Dress", exact: true }).first()).toBeVisible();
});
