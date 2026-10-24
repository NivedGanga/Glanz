import { createHash, randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db/index";
import { localToUtc } from "../src/lib/availability";

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
if (process.env.APP_ENV !== "development" || process.env.DEMO_MODE !== "1" ||
  process.env.STORAGE_PROVIDER !== "local" || process.env.PHOTO_TAGGER !== "fake")
  throw new Error("Demo flow requires local storage, fake tagging and development demo mode");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, origin), init);
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
const json = (method: string, value: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value)
});
async function waitForPhoto(photoId: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const [analysis] = await db.execute(sql`SELECT status FROM photo_analysis WHERE photo_id=${photoId}::uuid`);
    if (analysis?.status === "done") return;
    if (analysis?.status === "failed") throw new Error("Fake photo analysis failed");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Photo analysis worker did not finish within 30 seconds");
}
async function main() {
  const [shop] = await db.execute(sql`SELECT s.id,s.phone,b.id AS branch_id,d.id AS seed_design_id,
    d.category_id,r.price_paise FROM shop s JOIN branch b ON b.shop_id=s.id
    JOIN design d ON d.shop_id=s.id JOIN rate_card r ON r.design_id=d.id AND r.period_type='day'
    WHERE s.is_fake ORDER BY s.legal_name LIMIT 1`);
  const [customer] = await db.execute(sql`SELECT id,phone FROM customer WHERE is_fake ORDER BY name LIMIT 1`);
  const [district] = await db.execute(sql`SELECT id,timezone FROM district WHERE is_fake LIMIT 1`);
  if (!shop || !customer || !district) throw new Error("Run db:migrate and db:seed first");
  const userId = randomUUID();
  await db.execute(sql`INSERT INTO shop_user(user_id,shop_id,email,role)
    VALUES (${userId}::uuid,${shop.id}::uuid,${`demo-${userId}@example.invalid`},'owner')`);
  async function session(type: "shop" | "customer", id: string) {
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(`${process.env.SESSION_SECRET}:${token}`).digest("hex");
    await db.execute(sql`INSERT INTO auth_session(token_hash,subject_type,subject_id,expires_at)
      VALUES (${hash},${type},${id}::uuid,now()+interval '1 hour')`);
    return { Cookie: `session=${token}` };
  }
  const owner = await session("shop", userId);
  const buyer = await session("customer", String(customer.id));
  const admin = { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` };
  for (const flag of [
    "shop.onboarding", "shop.inventory", "shop.catalog_link", "shop.photo_entry",
    "availability.blocks", "marketplace.publish", "marketplace.pause",
    "marketplace.report", "search.fuzzy_keywords", "customer.search", "customer.distance_filter",
    "customer.request", "customer.photo_tagging", "reco.v1", "reco.fuzzy_keywords",
    "shop.inbox", "shop.decline", "shop.verified_badge"
  ]) await api("/api/flags", json("PATCH", { key: flag, enabled: true }, admin));

  const { id: designId } = await api<{ id: string }>(`/api/shops/${shop.id}/designs`,
    json("POST", { categoryId: shop.category_id, name: "Dress", description: "Stage performance dress",
      attributes: { gender_fit: "women", colour: "red", era_style: "traditional",
        occasion: "stage", size_range: "medium" } }, owner));
  const { id: unitId } = await api<{ id: string }>(`/api/shops/${shop.id}/units`,
    json("POST", { designId, branchId: shop.branch_id, condition: "good" }, owner));
  await api(`/api/shops/${shop.id}/rates`,
    json("PUT", { designId, periodType: "day", pricePaise: Number(shop.price_paise) }, owner));
  const image = await sharp({ create: { width: 240, height: 340, channels: 3,
    background: "#b34b38" } }).png().toBuffer();
  async function upload(path: string, fields: Record<string, string>, cookie: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.set("photo", new Blob([Uint8Array.from(image)], { type: "image/png" }), "synthetic.png");
    return api<{ photoId: string; pending?: boolean; analysisPending?: boolean }>(path,
      { method: "POST", headers: cookie, body: form });
  }
  const designPhoto = await upload(`/api/shops/${shop.id}/photos`,
    { designId, synthetic: "true" }, owner);
  if (!designPhoto.pending) throw new Error("Listing photo was not queued");
  await waitForPhoto(designPhoto.photoId);
  const [tag] = await db.execute(sql`SELECT id FROM tag WHERE entity_type='design'
    AND entity_id=${designId}::uuid AND status='suggested' LIMIT 1`);
  if (!tag) throw new Error("No suggested tag found");
  await api(`/api/shops/${shop.id}/tags`,
    json("PATCH", { tagId: tag.id, action: "confirm" }, owner));
  await api(`/api/shops/${shop.id}/status`,
    json("PATCH", { status: "published", designId }, owner));
  await api(`/api/shops/${shop.id}/status`, json("PATCH", { status: "published" }, owner));
  async function photoResponse(photoId: string, headers?: Record<string, string>) {
    return fetch(new URL(`/api/media/${photoId}`, origin), { headers, redirect: "manual" });
  }
  const listingLink = await photoResponse(designPhoto.photoId);
  if (listingLink.status !== 307 || !(await fetch(listingLink.headers.get("location")!)).ok)
    throw new Error("Published listing photo was not privately stored and publicly visible");
  const { path: catalogPath } = await api<{ path: string }>(
    `/api/shops/${shop.id}/catalog`, { method: "POST", headers: owner });
  if (!(await fetch(new URL(catalogPath, origin))).ok) throw new Error("Public catalog link failed");
  await api(`/api/shops/${shop.id}/catalog`, { method: "DELETE", headers: owner });
  if ((await fetch(new URL(catalogPath, origin))).status !== 404)
    throw new Error("Revoked catalog link still works");

  const date = (days: number) => {
    const future = new Date(Date.now() + days * 86_400_000);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: String(district.timezone), year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(future).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const eventStart = date(4);
  const returnEnd = date(5);
  const params = new URLSearchParams({ districtId: String(district.id), eventStart, returnEnd,
    categoryId: String(shop.category_id), keyword: "dresss" });
  const { results } = await api<{ results: { id: string; phone: string }[] }>(`/api/search?${params}`);
  if (!results.some(result => result.id === designId && result.phone === shop.phone))
    throw new Error("Misspelled keyword search missed the published design");
  const { id: requestId } = await api<{ id: string }>("/api/requests",
    json("POST", { districtId: district.id, categoryId: shop.category_id,
      eventStart, returnEnd, description: "dresss for stage performance", groupSize: 1,
      answers: { colour: "red", occasion: "stage", size_range: "medium" },
      consentToAi: true, consentVersion: "1", contactConsentVersion: "1" }, buyer));
  const requestPhoto = await upload(`/api/requests/${requestId}/photos`, { synthetic: "true" }, buyer);
  if (!requestPhoto.analysisPending) throw new Error("Consented request photo was not queued");
  await waitForPhoto(requestPhoto.photoId);
  if ((await photoResponse(requestPhoto.photoId, owner)).status !== 403)
    throw new Error("Unselected shop could see private request photo");
  const { shown } = await api<{ shown: { shopId: string }[] }>(
    `/api/requests/${requestId}/recommendations`, { headers: buyer });
  if (!shown.some(item => item.shopId === shop.id)) throw new Error("Shop was not recommended");
  const inboxPath = `/api/shops/${shop.id}/inbox`;
  if ((await api<{ requests: { id: string }[] }>(inboxPath, { headers: owner })).requests
    .some(item => item.id === requestId)) throw new Error("Shop saw an unselected request");
  await api(`/api/requests/${requestId}/select`,
    json("POST", { shopIds: [shop.id] }, buyer));
  const selectedPhoto = await photoResponse(requestPhoto.photoId, owner);
  if (selectedPhoto.status !== 307 || !(await fetch(selectedPhoto.headers.get("location")!)).ok)
    throw new Error("Selected shop could not see the request photo");
  if (!(await api<{ requests: { id: string }[] }>(inboxPath, { headers: owner })).requests
    .some(item => item.id === requestId)) throw new Error("Selected request missing from inbox");
  await api(inboxPath, json("PATCH", { requestId, action: "interested" }, owner));
  const { id: privateRequestId } = await api<{ id: string }>("/api/requests",
    json("POST", { districtId: district.id, categoryId: shop.category_id,
      eventStart, returnEnd, description: "Dress for a photo shoot", groupSize: 1,
      answers: { colour: "red" }, consentToAi: false, consentVersion: "1",
      contactConsentVersion: "1" }, buyer));
  const privatePhoto = await upload(`/api/requests/${privateRequestId}/photos`,
    { synthetic: "true" }, buyer);
  const [privateAnalysis] = await db.execute(sql`SELECT count(*) AS total FROM photo_analysis
    WHERE photo_id=${privatePhoto.photoId}::uuid`);
  if (privatePhoto.analysisPending || Number(privateAnalysis.total) !== 0)
    throw new Error("Photo without consent was sent for analysis");
  await api("/api/admin/verify", json("PATCH",
    { shopId: shop.id, verified: true, checkNote: "Manual demo identity review" }, admin));
  const { shop: profile } = await api<{ shop: { phone: string; verified_at: string } }>(
    `/api/shops/${shop.id}`);
  if (profile.phone !== shop.phone || !profile.verified_at) throw new Error("Shop profile missed open contact details");
  const { id: reportId } = await api<{ id: string }>("/api/reports",
    json("POST", { targetType: "design", targetId: designId, reason: "Demo photo review request" }));
  await api("/api/admin/reports", json("PATCH",
    { id: reportId, status: "reviewed", note: "Synthetic demo review" }, admin));

  await api(`/api/shops/${shop.id}/blocks`, json("POST", {
    unitId, start: localToUtc(eventStart, String(district.timezone)).toISOString(),
    end: localToUtc(returnEnd, String(district.timezone)).toISOString(), kind: "rental"
  }, owner)).catch(error => {
    throw new Error(`Manual rental block failed: ${String(error)}`);
  });
  const later = new URLSearchParams({ districtId: String(district.id),
    eventStart: date(15), returnEnd: date(16), keyword: "dresss" });
  await api(`/api/shops/${shop.id}/status`, json("PATCH", { status: "paused" }, owner));
  if ((await api<{ results: { id: string }[] }>(`/api/search?${later}`)).results
    .some(item => item.id === designId)) throw new Error("Paused shop appeared in search");
  await api(`/api/shops/${shop.id}/status`, json("PATCH", { status: "published" }, owner));
  const [events] = await db.execute(sql`SELECT count(*) AS total FROM event
    WHERE type IN ('photo.uploaded','tag.reviewed','recommendation.shown',
      'recommendation.sent','recommendation.interested','availability.changed')`);
  if (Number(events.total) < 6) throw new Error("Outcome or availability events missing");
  console.info("Local demo passed: upload, fake tags, review, publish, typo search, consent,");
  console.info("catalog revocation, explicit selection, private photo, inbox response,");
  console.info("moderation, verification, rental block and pause.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
