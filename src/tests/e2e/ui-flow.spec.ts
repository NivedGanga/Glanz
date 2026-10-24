import { test, expect } from "@playwright/test";
import pg from "pg";

const CUSTOMER_PHONE = "+919000000201";

async function lastDevMessage(request: import("@playwright/test").APIRequestContext,
  channel: "sms" | "email", to: string) {
  const before = (await (await request.get(
    `/api/dev/otp?channel=${channel}&to=${encodeURIComponent(to)}`)).json()).body as string | null;
  for (let i = 0; i < 20; i++) {
    const r = await request.get(`/api/dev/otp?channel=${channel}&to=${encodeURIComponent(to)}`);
    const body = (await r.json()).body as string | null;
    if (body && body !== before) return body;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`No dev ${channel} message for ${to}`);
}

test("customer searches, requests and picks a shop; shop replies in its inbox", async ({ page, browser, request }) => {
  test.skip(process.env.RUN_DEMO_E2E !== "1", "Needs local demo stack");
  test.setTimeout(90_000);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows: [district] } = await db.query("SELECT id, timezone FROM district WHERE is_fake LIMIT 1");
  const { rows: [category] } = await db.query("SELECT id FROM category LIMIT 1");
  const { rows: [shop] } = await db.query(
    "SELECT id FROM shop WHERE is_fake AND listing_status='published' LIMIT 1");
  await db.query(`INSERT INTO shop_user(user_id,shop_id,email,role)
    VALUES ('00000000-0000-4000-8000-0000000000e2',$1,'playwright-owner@example.invalid','owner')
    ON CONFLICT DO NOTHING`, [shop.id]);

  // Clear stale demo challenges so the 5/hour OTP limit does not block the run;
  // the rate limit itself is exercised in unit tests and earlier live checks.
  await db.query("DELETE FROM auth_challenge WHERE identity=$1 OR identity=$2",
    [CUSTOMER_PHONE, "playwright-owner@example.invalid"]);

  // --- Customer portal: real OTP sign-in, misspelled search, request, selection ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByLabel("District").selectOption(district.id);
  await page.getByLabel("Phone").fill(CUSTOMER_PHONE);
  await page.getByRole("button", { name: "Send code" }).click();
  const code = await lastDevMessage(request, "sms", CUSTOMER_PHONE);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Create request" })).toBeVisible();

  const local = (days: number) => new Intl.DateTimeFormat("en-CA", {
    timeZone: district.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
      new Date(Date.now() + days * 86_400_000)).replace(", ", "T");
  await page.getByLabel("Event date").fill(local(15));
  await page.getByLabel("Return date").fill(local(16));
  await page.getByLabel("Keyword").fill("dresss");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Dress" }).first()).toBeVisible();

  await page.getByLabel("Category ID").fill(category.id);
  await page.getByLabel("Describe what you need").fill("dresss for a stage performance");
  await page.getByLabel("Synthetic staging photo").check();
  await page.getByLabel(/consent to AI/i).check();
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page.getByRole("heading", { name: "Choose shops to contact" })).toBeVisible();
  const shopBox = page.locator(".card", { hasText: "Choose shops to contact" })
    .locator("input[type=checkbox]").first();
  await expect(shopBox).toBeVisible();
  await shopBox.check();
  await page.getByRole("button", { name: "Send to selected shops" }).click();
  await expect(page.getByRole("status")).toContainText("Request sent");

  // --- Shop portal: real magic-link sign-in and inbox response ---
  const shopContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const shopPage = await shopContext.newPage();
  await shopPage.goto("/shop");
  await shopPage.getByLabel("Email").fill("playwright-owner@example.invalid");
  await shopPage.getByRole("button", { name: "Send sign-in link" }).click();
  const link = await lastDevMessage(request, "email", "playwright-owner@example.invalid");
  const token = /token=([0-9a-f]{64})/.exec(link)?.[1];
  expect(token).toBeTruthy();
  await shopPage.getByLabel("Magic link token").fill(token!);
  await shopPage.getByRole("button", { name: "Sign in" }).click();
  await expect(shopPage.getByRole("heading", { name: "Selected requests" })).toBeVisible();
  const card = shopPage.locator(".card", { hasText: "dresss for a stage performance" }).last();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Interested" }).click();
  const { rows: [state] } = await db.query(
    "SELECT status FROM request_shop WHERE shop_id=$1 ORDER BY request_id DESC LIMIT 1", [shop.id]);
  expect(state.status).toBe("interested");
  await db.end();
});
