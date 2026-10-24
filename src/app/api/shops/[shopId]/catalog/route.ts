import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop, digest } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { recordEvent } from "../../../../../lib/events";

export async function POST(_: Request, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.catalog_link", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const token = randomBytes(32).toString("base64url");
    await db.execute(sql`UPDATE shop SET catalog_token_hash=${digest(token)} WHERE id=${shopId}::uuid`);
    await recordEvent(actor, "catalog.link_rotated", shopId);
    return NextResponse.json({ path: `/catalog/${token}` });
  });
}
export async function DELETE(_: Request, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.catalog_link", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    await db.execute(sql`UPDATE shop SET catalog_token_hash=NULL WHERE id=${shopId}::uuid`);
    await recordEvent(actor, "catalog.link_revoked", shopId);
    return NextResponse.json({ ok: true });
  });
}
